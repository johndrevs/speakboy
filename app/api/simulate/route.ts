import { NextResponse } from "next/server";
import { z } from "zod";

import { generatePetReply } from "@/lib/pet-reply";
import {
  appendThreadMessage,
  findPetById,
  getThreadMessages
} from "@/lib/store";

export const runtime = "nodejs";

const simulateSchema = z.object({
  petId: z.string().min(1),
  fromNumber: z.string().min(7),
  message: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = simulateSchema.parse(json);
    const profile = await findPetById(payload.petId);

    if (!profile) {
      return NextResponse.json(
        { message: "Pet persona not found." },
        { status: 404 }
      );
    }

    const threadKey = `${payload.fromNumber}:${profile.twilioNumber}`;
    const history = await getThreadMessages(threadKey);

    await appendThreadMessage(threadKey, {
      role: "user",
      body: payload.message
    });

    const reply = await generatePetReply({
      profile,
      incomingMessage: payload.message,
      history
    });

    await appendThreadMessage(threadKey, {
      role: "assistant",
      body: reply.text
    });

    const updatedHistory = await getThreadMessages(threadKey);

    return NextResponse.json({
      message:
        reply.source === "openai"
          ? "Simulated SMS exchange created with OpenAI."
          : "Simulated SMS exchange created using fallback reply.",
      threadKey,
      reply: reply.text,
      replySource: reply.source,
      history: updatedHistory
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to simulate message.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
