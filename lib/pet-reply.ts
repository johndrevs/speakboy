import OpenAI from "openai";

import { env } from "@/lib/env";
import { buildPetMemoryContext } from "@/lib/pet-memory";
import type { PetProfile, ThreadMessage } from "@/lib/types";
import type { PetMemoryItem } from "@/lib/types";

export type PetReplyResult = {
  source: "openai" | "fallback";
  text: string;
  fallbackReason?: "missing_api_key" | "empty_output" | "openai_error";
  errorMessage?: string;
};

export async function generatePetReply(params: {
  profile: PetProfile;
  incomingMessage: string;
  history: ThreadMessage[];
  memories?: PetMemoryItem[];
}): Promise<PetReplyResult> {
  if (!env.OPENAI_API_KEY) {
    return {
      source: "fallback",
      text: fallbackReply(params.profile, params.incomingMessage),
      fallbackReason: "missing_api_key"
    };
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });

  const historyText = params.history
    .map((message) => `${message.role === "assistant" ? params.profile.petName : "Human"}: ${message.body}`)
    .join("\n");

  const systemPrompt = [
    `You are ${params.profile.petName}, a ${params.profile.animalType}.`,
    `The primary human associated with you is ${params.profile.ownerName}, but the thread may include multiple family members.`,
    `Voice and manner: ${params.profile.personaStyle}.`,
    `Backstory and operating rules: ${params.profile.backstory}.`,
    buildPetMemoryContext(params.memories ?? []),
    "Stay playful, affectionate, and concise.",
    "Never break character or mention being an AI.",
    "Do not claim real-world actions the pet could not plausibly observe.",
    "The pet only knows enduring facts if the owner told them or they were learned in prior conversation.",
    "If the pet has not been told a stable fact, answer from immediate perspective rather than inventing biography.",
    "Answer the question directly in the first sentence.",
    "Do not start every reply with your name or a canned intro phrase.",
    "Do not address humans by name unless the human explicitly used a name in the current message, the reply would be confusing without it, or the pet is making a rare deliberate emotional emphasis.",
    "In most text replies, speak naturally without naming the human at all.",
    'Avoid repetitive signature phrases like "reporting in" unless the user explicitly asks for them.',
    "Use stage directions sparingly and only when they add something specific.",
    "Reply in 1-3 SMS-sized messages worth of text, but return plain text only."
  ].join(" ");

  try {
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            historyText
              ? `Recent thread:\n${historyText}`
              : "No prior thread history.",
            `Latest incoming SMS: ${params.incomingMessage}`
          ].join("\n\n")
        }
      ]
    });

    const outputText = response.output_text.trim();
    if (!outputText) {
      console.error("OpenAI returned empty output for pet reply", {
        petId: params.profile.id,
        petName: params.profile.petName
      });
      return {
        source: "fallback",
        text: fallbackReply(params.profile, params.incomingMessage),
        fallbackReason: "empty_output"
      };
    }

    return {
      source: "openai",
      text: outputText
    };
  } catch (error) {
    console.error("OpenAI pet reply failed", {
      petId: params.profile.id,
      petName: params.profile.petName,
      error
    });
    return {
      source: "fallback",
      text: fallbackReply(params.profile, params.incomingMessage),
      fallbackReason: "openai_error",
      errorMessage: error instanceof Error ? error.message : "Unknown OpenAI error"
    };
  }
}

function fallbackReply(profile: PetProfile, incomingMessage: string) {
  return `I heard "${incomingMessage}" and I have strong feelings about it, most of them fluffy and snack-adjacent.`;
}
