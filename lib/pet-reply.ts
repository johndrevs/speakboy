import OpenAI from "openai";

import { env } from "@/lib/env";
import type { PetProfile, ThreadMessage } from "@/lib/types";

export type PetReplyResult = {
  source: "openai" | "fallback";
  text: string;
};

export async function generatePetReply(params: {
  profile: PetProfile;
  incomingMessage: string;
  history: ThreadMessage[];
}): Promise<PetReplyResult> {
  if (!env.OPENAI_API_KEY) {
    return {
      source: "fallback",
      text: fallbackReply(params.profile, params.incomingMessage)
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
    `Your owner is ${params.profile.ownerName}.`,
    `Voice and manner: ${params.profile.personaStyle}.`,
    `Backstory and operating rules: ${params.profile.backstory}.`,
    "Stay playful, affectionate, and concise.",
    "Never break character or mention being an AI.",
    "Do not claim real-world actions the pet could not plausibly observe.",
    "Answer the question directly in the first sentence.",
    "Do not start every reply with your name or a canned intro phrase.",
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
        text: fallbackReply(params.profile, params.incomingMessage)
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
      text: fallbackReply(params.profile, params.incomingMessage)
    };
  }
}

function fallbackReply(profile: PetProfile, incomingMessage: string) {
  return `I heard "${incomingMessage}" and I have strong feelings about it, most of them fluffy and snack-adjacent.`;
}
