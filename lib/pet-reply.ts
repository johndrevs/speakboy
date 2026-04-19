import OpenAI from "openai";

import { env } from "@/lib/env";
import type { PetProfile, ThreadMessage } from "@/lib/types";

export async function generatePetReply(params: {
  profile: PetProfile;
  incomingMessage: string;
  history: ThreadMessage[];
}) {
  if (!env.OPENAI_API_KEY) {
    return fallbackReply(params.profile, params.incomingMessage);
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

    return (
      response.output_text.trim() ||
      fallbackReply(params.profile, params.incomingMessage)
    );
  } catch {
    return fallbackReply(params.profile, params.incomingMessage);
  }
}

function fallbackReply(profile: PetProfile, incomingMessage: string) {
  return `${profile.petName} reporting in: I heard "${incomingMessage}" and I would like it on record that I am adorable, available, and waiting for snacks.`;
}
