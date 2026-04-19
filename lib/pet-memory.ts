import OpenAI from "openai";

import { env } from "@/lib/env";
import type { PetMemoryItem, PetProfile, ThreadMessage } from "@/lib/types";

type MemoryDraft = Omit<
  PetMemoryItem,
  "id" | "petId" | "createdAt" | "updatedAt"
>;

type ExtractionResult = {
  items: MemoryDraft[];
};

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

  const memorySummary = summarizeMemories(params.existingMemories);
  const historyText = params.history
    .slice(-6)
    .map((message) => `${message.role === "user" ? "Owner" : params.profile.petName}: ${message.body}`)
    .join("\n");

  const prompt = [
    `You are extracting long-term memory for ${params.profile.petName}, a ${params.profile.animalType}.`,
    "The pet has no privileged knowledge about its own existential makeup.",
    "Only store facts the owner explicitly told the pet, or highly reliable stable patterns observed in conversation.",
    "Prefer owner-told facts over inference.",
    "Do not store one-off jokes, temporary emotions, or generic chatter.",
    "Return JSON only with an `items` array.",
    "Each item must include: category, subject, key, value, source, confidence.",
    "Use confidence from 0 to 1.",
    "Use short snake_case keys."
  ].join(" ");

  try {
    const response = await client.responses.create({
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
      return heuristicItems;
    }

    const parsed = JSON.parse(raw) as ExtractionResult;
    return dedupeMemoryDrafts([
      ...heuristicItems,
      ...(parsed.items ?? []).filter(isValidMemoryDraft)
    ]);
  } catch (error) {
    console.error("Pet memory extraction failed", {
      petId: params.profile.id,
      petName: params.profile.petName,
      error
    });
    return heuristicItems;
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
