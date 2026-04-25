import OpenAI from "openai";
import { z } from "zod";

import { env } from "@/lib/env";
import type { PetMemoryItem, PetProfile, ThreadMessage } from "@/lib/types";

type MemoryDraft = Omit<
  PetMemoryItem,
  "id" | "petId" | "createdAt" | "updatedAt"
>;

type ExtractionResult = {
  memory_items?: MemoryDraft[];
  personality_inserts?: PersonalityInsert[];
};

type PersonalityInsert = {
  trait: PersonalityTrait;
  summary: string;
  confidence: number;
};

const personalityTraits = [
  "curiosity",
  "sociability",
  "affection",
  "playfulness",
  "boldness",
  "sensitivity",
  "calmness",
  "food_motivation",
  "protectiveness",
  "stubbornness"
] as const;

type PersonalityTrait = (typeof personalityTraits)[number];

const validCategories = new Set<PetMemoryItem["category"]>([
  "identity",
  "relationship",
  "preference",
  "routine",
  "biography"
]);

const validSubjects = new Set<PetMemoryItem["subject"]>([
  "self",
  "owner",
  "other"
]);

const validSources = new Set<PetMemoryItem["source"]>([
  "told_by_owner",
  "observed_in_conversation",
  "inferred_from_pattern",
  "expressed_by_pet"
]);

const modelMemoryItemSchema = z.object({
  category: z.enum(["identity", "relationship", "preference", "routine", "biography"]),
  subject: z.enum(["self", "owner", "other"]),
  key: z.string().min(1),
  value: z.string().min(1),
  source: z.enum([
    "told_by_owner",
    "observed_in_conversation",
    "inferred_from_pattern",
    "expressed_by_pet"
  ]),
  confidence: z.number().min(0).max(1)
});

const modelPersonalityInsertSchema = z.object({
  trait: z.enum(personalityTraits),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

const modelExtractionSchema = z.object({
  memory_items: z.array(modelMemoryItemSchema).default([]),
  personality_inserts: z.array(modelPersonalityInsertSchema).default([])
});

export async function extractPetMemories(params: {
  profile: PetProfile;
  incomingMessage: string;
  assistantReply: string;
  history: ThreadMessage[];
  existingMemories: PetMemoryItem[];
}): Promise<MemoryDraft[]> {
  const heuristicItems = [
    ...extractHeuristicMemories(params.incomingMessage),
    ...extractConfirmedRelationshipMemories(
      params.incomingMessage,
      params.assistantReply
    ),
    ...extractPetExpressedMemories(params.assistantReply)
  ];

  if (!env.OPENAI_API_KEY) {
    return heuristicItems;
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });

  const modelSuggestedItems = await extractModelSuggestedMemories({
    client,
    profile: params.profile,
    incomingMessage: params.incomingMessage,
    assistantReply: params.assistantReply,
    history: params.history,
    existingMemories: params.existingMemories
  });

  return dedupeMemoryDrafts([
    ...heuristicItems,
    ...modelSuggestedItems
  ]);
}

async function extractModelSuggestedMemories(params: {
  client: OpenAI;
  profile: PetProfile;
  incomingMessage: string;
  assistantReply: string;
  history: ThreadMessage[];
  existingMemories: PetMemoryItem[];
}): Promise<MemoryDraft[]> {
  const memorySummary = summarizeMemories(params.existingMemories);
  const historyText = params.history
    .slice(-6)
    .map((message) => `${message.role === "user" ? "Owner" : params.profile.petName}: ${message.body}`)
    .join("\n");

  const prompt = [
    `You are extracting long-term memory for ${params.profile.petName}, a ${params.profile.animalType}.`,
    "The pet has no privileged knowledge about its own existential makeup.",
    "You may suggest two things: factual memory_items and personality_inserts.",
    "Only store facts the owner explicitly told the pet, or highly reliable stable patterns observed in conversation.",
    "Prefer owner-told facts over inference. Be conservative.",
    "Do not store one-off jokes, temporary emotions, generic chatter, or decorative wording.",
    "Use memory_items for stable facts, routines, relationships, preferences, and biography.",
    `Use personality_inserts only for slow-burn tendencies and only from this trait list: ${personalityTraits.join(", ")}.`,
    "Personality inserts should be short pet-personality summaries, not numeric scores.",
    "Return JSON only with keys `memory_items` and `personality_inserts`.",
    "Each memory_item must include: category, subject, key, value, source, confidence.",
    "Each personality_insert must include: trait, summary, confidence.",
    "Use confidence from 0 to 1.",
    "Use short snake_case keys for memory items.",
    "If nothing should be stored, return empty arrays."
  ].join(" ");

  try {
    const response = await params.client.responses.create({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            memorySummary ? `Existing memories:\n${memorySummary}` : "No existing long-term memories yet.",
            historyText ? `Recent thread:\n${historyText}` : "No recent thread history.",
            `Latest owner message: ${params.incomingMessage}`,
            `Latest pet reply: ${params.assistantReply}`
          ].join("\n\n")
        }
      ]
    });

    const raw = response.output_text.trim();
    if (!raw) {
      return [];
    }

    const parsed = modelExtractionSchema.parse(
      JSON.parse(extractJsonObject(raw))
    ) as ExtractionResult;

    return dedupeMemoryDrafts([
      ...(parsed.memory_items ?? []).filter(isValidMemoryDraft),
      ...toPersonalityMemoryDrafts(parsed.personality_inserts ?? [])
    ]);
  } catch (error) {
    console.error("Pet model memory extraction failed", {
      petId: params.profile.id,
      petName: params.profile.petName,
      error
    });
    return [];
  }
}

export function buildPetMemoryContext(memories: PetMemoryItem[]) {
  if (memories.length === 0) {
    return "No learned long-term memories yet. The pet should answer from immediate experience unless the owner has clearly told it something.";
  }

  const grouped = memories.slice(0, 16).map((memory) => {
    return `- ${memory.subject}.${memory.key}: ${memory.value} (source: ${memory.source}, confidence: ${memory.confidence.toFixed(2)})`;
  });

  return [
    "Learned long-term memory:",
    ...grouped,
    "Only rely on these stable facts if they fit the pet's point of view."
  ].join("\n");
}

function summarizeMemories(memories: PetMemoryItem[]) {
  return memories
    .slice(0, 12)
    .map((memory) => `${memory.subject}.${memory.key}=${memory.value}`)
    .join("\n");
}

function extractJsonObject(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw;
}

function toPersonalityMemoryDrafts(inserts: PersonalityInsert[]): MemoryDraft[] {
  return inserts
    .filter((insert) => insert.summary.trim().length > 0)
    .map((insert) => ({
      category: "identity" as const,
      subject: "self" as const,
      key: `trait_${insert.trait}`,
      value: normalizeValue(insert.summary),
      source: "inferred_from_pattern" as const,
      confidence: clampConfidence(insert.confidence, 0.55, 0.88)
    }));
}

function clampConfidence(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isValidMemoryDraft(item: MemoryDraft | undefined): item is MemoryDraft {
  return Boolean(
    item &&
      validCategories.has(item.category) &&
      validSubjects.has(item.subject) &&
      item.key &&
      item.value &&
      validSources.has(item.source) &&
      typeof item.confidence === "number"
  );
}

function extractHeuristicMemories(message: string): MemoryDraft[] {
  const items: MemoryDraft[] = [];
  const sentences = message
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const householdMembers =
      matchHouseholdMembers(trimmed, [
        /\bin your household (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) household (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) household members? (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) family (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) family members? (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) people (?:is|are)\s+(.+)$/i,
        /\b(?:your|our) people include\s+(.+)$/i,
        /\b(?:your|our) household includes\s+(.+)$/i,
        /\b(?:your|our) family includes\s+(.+)$/i,
        /\b(?:your|our) home includes\s+(.+)$/i,
        /\bat home (?:it(?:'s| is)|you have)\s+(.+)$/i,
        /\bin the house (?:it(?:'s| is)|you have)\s+(.+)$/i,
        /\byou live with\s+(.+)$/i,
        /\byou stay with\s+(.+)$/i,
        /\byou share the house with\s+(.+)$/i,
        /\byou share your home with\s+(.+)$/i,
        /\byou live at home with\s+(.+)$/i,
        /\bwho lives with you is\s+(.+)$/i,
        /\bthe people in your house are\s+(.+)$/i,
        /\bthe people at home are\s+(.+)$/i
      ]);
    if (householdMembers.length > 0) {
      items.push(makeHouseholdMemoryDraft(householdMembers, "told_by_owner", 0.97));
    }

    const liveMatch = trimmed.match(/\bwe live in ([a-zA-Z\s]+)$/i);
    if (liveMatch) {
      items.push({
        category: "biography",
        subject: "self",
        key: "home_city",
        value: normalizeValue(liveMatch[1]),
        source: "told_by_owner",
        confidence: 0.99
      });
    }

    const fromMatch = trimmed.match(/\byou(?:'re| are| were| seem| sound)(?: basically| kind of)? from ([a-zA-Z\s]+)$/i);
    if (fromMatch) {
      items.push({
        category: "biography",
        subject: "self",
        key: "hometown",
        value: normalizeValue(fromMatch[1]),
        source: "told_by_owner",
        confidence: 0.96
      });
    }

    const bestMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) (?:gives you|has|is) the best ([a-zA-Z\s]+)$/i
    );
    if (bestMatch) {
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(bestMatch[1])}_best_${toSnakeCase(bestMatch[2])}`,
        value: `${normalizeValue(bestMatch[1])} gives the best ${normalizeValue(bestMatch[2]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.95
      });
    }

    const routineMatch = trimmed.match(
      /\byou (?:always|usually|often)? ?(?:get|go) ([a-zA-Z\s]+) after ([a-zA-Z\s]+)$/i
    );
    if (routineMatch) {
      items.push({
        category: "routine",
        subject: "self",
        key: `after_${toSnakeCase(routineMatch[2])}_behavior`,
        value: `gets ${normalizeValue(routineMatch[1]).toLowerCase()} after ${normalizeValue(routineMatch[2]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.95
      });
    }

    const loveMatch = trimmed.match(/\byou (?:love|like|really like) ([a-zA-Z\s]+)$/i);
    if (loveMatch) {
      items.push({
        category: "preference",
        subject: "self",
        key: `likes_${toSnakeCase(loveMatch[1])}`,
        value: `likes ${normalizeValue(loveMatch[1]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.94
      });
    }

    const favoriteMatch = trimmed.match(
      /\byour favorite ([a-zA-Z\s]+) is ([a-zA-Z0-9\s'&-]+)$/i
    );
    if (favoriteMatch) {
      items.push({
        category: "preference",
        subject: "self",
        key: `favorite_${toSnakeCase(favoriteMatch[1])}`,
        value: normalizeValue(favoriteMatch[2]),
        source: "told_by_owner",
        confidence: 0.99
      });
    }

    const hateMatch = trimmed.match(/\byou (?:hate|don't like|do not like|are a .* hater of|are kind of a .* hater of)? ?([a-zA-Z\s]+)$/i);
    if (hateMatch && /hate|don't like|do not like|hater/i.test(trimmed)) {
      items.push({
        category: "preference",
        subject: "self",
        key: `dislikes_${toSnakeCase(hateMatch[1])}`,
        value: `dislikes ${normalizeValue(hateMatch[1]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.93
      });
    }

    const fearMatch = trimmed.match(/\byou (?:are|get|seem) (?:scared|nervous|afraid) (?:of|during|around) ([a-zA-Z\s]+)$/i);
    if (fearMatch) {
      items.push({
        category: "preference",
        subject: "self",
        key: `fear_${toSnakeCase(fearMatch[1])}`,
        value: `gets nervous around ${normalizeValue(fearMatch[1]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.96
      });
    }

    const sleepMatch = trimmed.match(/\byou sleep (?:on|in|by|under|near) ([a-zA-Z\s]+)$/i);
    if (sleepMatch) {
      items.push({
        category: "routine",
        subject: "self",
        key: "sleep_spot",
        value: `sleeps ${inferPreposition(trimmed, "sleep")} ${normalizeValue(sleepMatch[1]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.95
      });
    }

    const roleMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) is your ([a-zA-Z\s-]+)$/i
    );
    if (roleMatch) {
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(roleMatch[1])}_role`,
        value: `${normalizeValue(roleMatch[1])} is ${normalizeValue(roleMatch[2]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.97
      });
    }

    const personPreferenceMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) (?:is|has always been) your favorite ([a-zA-Z\s]+)$/i
    );
    if (personPreferenceMatch) {
      items.push({
        category: "relationship",
        subject: "other",
        key: `favorite_${toSnakeCase(personPreferenceMatch[2])}`,
        value: normalizeValue(personPreferenceMatch[1]),
        source: "told_by_owner",
        confidence: 0.95
      });
    }

    const weekdaysMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) (?:leaves|goes to work|heads out) (?:early )?(?:on )?weekdays$/i
    );
    if (weekdaysMatch) {
      items.push({
        category: "routine",
        subject: "owner",
        key: `${toSnakeCase(weekdaysMatch[1])}_weekday_routine`,
        value: `${normalizeValue(weekdaysMatch[1])} leaves on weekdays`,
        source: "told_by_owner",
        confidence: 0.93
      });
    }

    const meansMatch = trimmed.match(
      /\bthe ([a-zA-Z\s]+) means ([a-zA-Z\s]+)$/i
    );
    if (meansMatch) {
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(meansMatch[1])}_association`,
        value: `${normalizeValue(meansMatch[1])} means ${normalizeValue(meansMatch[2]).toLowerCase()}`,
        source: "told_by_owner",
        confidence: 0.91
      });
    }
  }

  return dedupeMemoryDrafts(items);
}

function dedupeMemoryDrafts(items: MemoryDraft[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.subject}:${item.key}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitNameList(value: string) {
  const normalized = normalizeValue(value)
    .replace(/\s+(?:and|&|\+|\/)\s+/gi, ", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\bplus\b/gi, ",");
  const coarseParts = normalized
    .split(",")
    .map((part) => normalizeValue(part))
    .filter(Boolean);

  const names = coarseParts.flatMap((part) => splitPackedNameChunk(part));
  return dedupeNames(names);
}

function splitPackedNameChunk(chunk: string) {
  if (!chunk) {
    return [];
  }

  const directMatch = chunk.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)?/g);
  if (!directMatch) {
    return [];
  }

  if (directMatch.length <= 1) {
    return directMatch.map(normalizePersonName).filter(Boolean);
  }

  const expanded: string[] = [];
  for (const match of directMatch) {
    const words = match.split(/\s+/).filter(Boolean);
    if (words.length === 2 && shouldKeepAsDoubleName(words[0], words[1])) {
      expanded.push(normalizePersonName(match));
      continue;
    }

    for (const word of words) {
      expanded.push(normalizePersonName(word));
    }
  }

  return expanded.filter(Boolean);
}

function shouldKeepAsDoubleName(first: string, second: string) {
  const normalizedFirst = normalizePersonName(first);
  const normalizedSecond = normalizePersonName(second);

  return (
    normalizedFirst.length > 2 &&
    normalizedSecond.length <= 3
  );
}

function normalizePersonName(value: string) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\s+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function dedupeNames(names: string[]) {
  const seen = new Set<string>();
  return names.filter((name) => {
    if (!name) {
      return false;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function matchHouseholdMembers(sentence: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (!match) {
      continue;
    }

    const members = splitNameList(match[1]);
    if (members.length > 0) {
      return members;
    }
  }

  return [];
}

function makeHouseholdMemoryDraft(
  members: string[],
  source: PetMemoryItem["source"],
  confidence: number
): MemoryDraft {
  return {
    category: "relationship",
    subject: "other",
    key: "household_members",
    value: members.join(", "),
    source,
    confidence
  };
}

function toSnakeCase(value: string) {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferPreposition(message: string, stem: string) {
  const match = message.match(new RegExp(`\\b${stem} (on|in|by|under|near)\\b`, "i"));
  return match ? match[1].toLowerCase() : "by";
}

function extractPersonName(sentence: string) {
  const cleaned = sentence.replace(/^(?:and|but|oh|so)\s+/i, "").trim();
  const match = cleaned.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/);
  if (!match) {
    return null;
  }

  const candidate = normalizeValue(match[1]);
  return isPronounLike(candidate) ? null : candidate;
}

function extractPossessivePersonName(sentence: string, phrase: string) {
  const pattern = new RegExp(
    `\\b(?:and |but )?([A-Z][a-z]+(?:\\s[A-Z][a-z]+)*)['’]s ${phrase}\\b`,
    "i"
  );
  const match = sentence.match(pattern);
  if (!match) {
    return null;
  }

  const candidate = normalizeValue(match[1]);
  return isPronounLike(candidate) ? null : candidate;
}

function isPronounLike(value: string) {
  return /^(?:she|he|they|it|we|i|you)$/i.test(value);
}

function isAffirmativeReply(reply: string) {
  return /\b(?:yes|yeah|yep|definitely|absolutely|for sure|of course|oh paws yes|sure is|totally)\b/i.test(
    reply
  );
}

function extractConfirmedRelationshipMemories(
  incomingMessage: string,
  assistantReply: string
): MemoryDraft[] {
  const items: MemoryDraft[] = [];
  const trimmedMessage = incomingMessage.trim();
  const trimmedReply = assistantReply.trim();

  const favoritePersonQuestion = trimmedMessage.match(
    /\bis ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) your favorite (?:person|human)\b/i
  );

  if (favoritePersonQuestion && isAffirmativeReply(trimmedReply)) {
    items.push({
      category: "relationship",
      subject: "other",
      key: "favorite_person",
      value: normalizeValue(favoritePersonQuestion[1]),
      source: "observed_in_conversation",
      confidence: 0.9
    });
  }

  const cuddlePersonQuestion = trimmedMessage.match(
    /\bis ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) your (?:favorite )?(?:cuddle|snuggle) person\b/i
  );
  if (cuddlePersonQuestion && isAffirmativeReply(trimmedReply)) {
    items.push({
      category: "relationship",
      subject: "other",
      key: "favorite_cuddle_person",
      value: normalizeValue(cuddlePersonQuestion[1]),
      source: "observed_in_conversation",
      confidence: 0.88
    });
  }

  const favoriteToyQuestion = trimmedMessage.match(
    /\bis ([A-Z][a-zA-Z0-9'& -]+) your favorite toy\b/i
  );
  if (favoriteToyQuestion && isAffirmativeReply(trimmedReply)) {
    items.push({
      category: "preference",
      subject: "self",
      key: "favorite_toy",
      value: normalizeValue(favoriteToyQuestion[1]),
      source: "observed_in_conversation",
      confidence: 0.9
    });
  }

  const likesThingQuestion = trimmedMessage.match(
    /\bdo you (?:love|like|really like) ([a-zA-Z0-9'& -]+)\b/i
  );
  if (likesThingQuestion && isAffirmativeReply(trimmedReply)) {
    const likedThing = normalizeValue(likesThingQuestion[1]);
    items.push({
      category: "preference",
      subject: "self",
      key: `likes_${toSnakeCase(likedThing)}`,
      value: `likes ${likedThing.toLowerCase()}`,
      source: "observed_in_conversation",
      confidence: 0.86
    });
  }

  const dislikeThingQuestion = trimmedMessage.match(
    /\bdo you (?:hate|dislike|not like) ([a-zA-Z0-9'& -]+)\b/i
  );
  if (dislikeThingQuestion && isAffirmativeReply(trimmedReply)) {
    const dislikedThing = normalizeValue(dislikeThingQuestion[1]);
    items.push({
      category: "preference",
      subject: "self",
      key: `dislikes_${toSnakeCase(dislikedThing)}`,
      value: `dislikes ${dislikedThing.toLowerCase()}`,
      source: "observed_in_conversation",
      confidence: 0.86
    });
  }

  const fearQuestion = trimmedMessage.match(
    /\bare you (?:scared|afraid|nervous) (?:of|during|around) ([a-zA-Z0-9'& -]+)\b/i
  );
  if (fearQuestion && isAffirmativeReply(trimmedReply)) {
    const fearThing = normalizeValue(fearQuestion[1]);
    items.push({
      category: "preference",
      subject: "self",
      key: `fear_${toSnakeCase(fearThing)}`,
      value: `gets nervous around ${fearThing.toLowerCase()}`,
      source: "observed_in_conversation",
      confidence: 0.88
    });
  }

  const routineQuestion = trimmedMessage.match(
    /\bdo you (?:always |usually |often )?(?:get|go) ([a-zA-Z\s]+) after ([a-zA-Z0-9'& -]+)\b/i
  );
  if (routineQuestion && isAffirmativeReply(trimmedReply)) {
    const behavior = normalizeValue(routineQuestion[1]);
    const trigger = normalizeValue(routineQuestion[2]);
    items.push({
      category: "routine",
      subject: "self",
      key: `after_${toSnakeCase(trigger)}_behavior`,
      value: `gets ${behavior.toLowerCase()} after ${trigger.toLowerCase()}`,
      source: "observed_in_conversation",
      confidence: 0.88
    });
  }

  const sleepSpotQuestion = trimmedMessage.match(
    /\bdo you sleep (?:on|in|by|under|near) ([a-zA-Z0-9'& -]+)\b/i
  );
  if (sleepSpotQuestion && isAffirmativeReply(trimmedReply)) {
    const spot = normalizeValue(sleepSpotQuestion[1]);
    const prepositionMatch = trimmedMessage.match(/\bdo you sleep (on|in|by|under|near)\b/i);
    const preposition = prepositionMatch?.[1]?.toLowerCase() ?? "by";
    items.push({
      category: "routine",
      subject: "self",
      key: "sleep_spot",
      value: `sleeps ${preposition} ${spot.toLowerCase()}`,
      source: "observed_in_conversation",
      confidence: 0.86
    });
  }

  const liveWithQuestion = trimmedMessage.match(
    /\bdo you live with\s+(.+)$/i
  );
  if (liveWithQuestion && isAffirmativeReply(trimmedReply)) {
    const members = splitNameList(liveWithQuestion[1]);
    if (members.length > 0) {
      items.push(
        makeHouseholdMemoryDraft(members, "observed_in_conversation", 0.88)
      );
    }
  }

  const householdQuestion = trimmedMessage.match(
    /\bare ([a-zA-Z\s,&+/']+) in your (?:household|family|house|home)\b/i
  );
  if (householdQuestion && isAffirmativeReply(trimmedReply)) {
    const members = splitNameList(householdQuestion[1]);
    if (members.length > 0) {
      items.push(
        makeHouseholdMemoryDraft(members, "observed_in_conversation", 0.86)
      );
    }
  }

  return dedupeMemoryDrafts(items);
}

function extractPetExpressedMemories(reply: string): MemoryDraft[] {
  const items: MemoryDraft[] = [];
  const sentences = reply
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let currentPerson: string | null = null;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const leadingPerson = extractPersonName(trimmed);
    if (leadingPerson) {
      currentPerson = leadingPerson;
    }

    const favoritePersonMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) is (?:like .+? )?(?:definitely |for sure |totally |absolutely |really )?my (?:absolute |very )?favorite (?:person|human)\b/i
    );
    if (favoritePersonMatch) {
      currentPerson = normalizeValue(favoritePersonMatch[1]);
      items.push({
        category: "relationship",
        subject: "other",
        key: "favorite_person",
        value: currentPerson,
        source: "expressed_by_pet",
        confidence: 0.74
      });
    }

    const favoriteRoleMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)[’']?s (?:got .+? )?(?:that extra magic|my )?(?:absolute |very )?favorite (?:person|human)\b/i
    );
    if (favoriteRoleMatch) {
      currentPerson = normalizeValue(favoriteRoleMatch[1]);
      items.push({
        category: "relationship",
        subject: "other",
        key: "favorite_person",
        value: currentPerson,
        source: "expressed_by_pet",
        confidence: 0.72
      });
    }

    const pronounFavoriteMatch = trimmed.match(
      /\b(?:she|he|they)(?:['’]s| is) (?:my )?(?:absolute |very )?favorite (?:person|human)(?:\s(?:for sure|definitely|totally|absolutely|really))?\b/i
    );
    if (pronounFavoriteMatch && currentPerson) {
      items.push({
        category: "relationship",
        subject: "other",
        key: "favorite_person",
        value: currentPerson,
        source: "expressed_by_pet",
        confidence: 0.7
      });
    }

    const extraMagicPerson = extractPossessivePersonName(
      trimmed,
      "got that extra magic"
    );
    if (extraMagicPerson) {
      currentPerson = extraMagicPerson;
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(currentPerson)}_bond`,
        value: `${currentPerson} has that extra magic`,
        source: "expressed_by_pet",
        confidence: 0.62
      });
    }

    const snuggleBuddyMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) (?:is|['’]s) my ([a-zA-Z\s]+buddy)\b/i
    );
    if (snuggleBuddyMatch) {
      currentPerson = normalizeValue(snuggleBuddyMatch[1]);
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(currentPerson)}_bond`,
        value: `${currentPerson} is ${normalizeValue(snuggleBuddyMatch[2]).toLowerCase()}`,
        source: "expressed_by_pet",
        confidence: 0.68
      });
    }

    const bestByPersonMatch = trimmed.match(
      /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*) gives the best ([a-zA-Z\s]+)$/i
    );
    if (bestByPersonMatch) {
      currentPerson = normalizeValue(bestByPersonMatch[1]);
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(currentPerson)}_best_${toSnakeCase(bestByPersonMatch[2])}`,
        value: `${currentPerson} gives the best ${normalizeValue(bestByPersonMatch[2]).toLowerCase()}`,
        source: "expressed_by_pet",
        confidence: 0.66
      });
    }

    const pronounBestMatch = trimmed.match(
      /\b(?:she|he|they) gives the best ([a-zA-Z\s]+)$/i
    );
    if (pronounBestMatch && currentPerson) {
      items.push({
        category: "relationship",
        subject: "other",
        key: `${toSnakeCase(currentPerson)}_best_${toSnakeCase(pronounBestMatch[1])}`,
        value: `${currentPerson} gives the best ${normalizeValue(pronounBestMatch[1]).toLowerCase()}`,
        source: "expressed_by_pet",
        confidence: 0.64
      });
    }
  }

  return dedupeMemoryDrafts(items);
}
