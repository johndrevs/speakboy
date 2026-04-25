import { NextResponse } from "next/server";
import { z } from "zod";

import { extractPetMemories } from "@/lib/pet-memory";
import { generatePetReply } from "@/lib/pet-reply";
import {
  appendThreadMessage,
  findPetById,
  getThreadMessages,
  listPetMemories,
  upsertPetMemories
} from "@/lib/store";

export const runtime = "nodejs";

const simulateSchema = z.object({
  petId: z.string().min(1),
  fromNumber: z.string().min(7),
  message: z.string().min(1)
});

const simulateLookupSchema = z.object({
  petId: z.string().min(1),
  fromNumber: z.string().min(7)
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = simulateLookupSchema.parse({
      petId: url.searchParams.get("petId"),
      fromNumber: url.searchParams.get("fromNumber")
    });
    const profile = await findPetById(payload.petId);

    if (!profile) {
      return NextResponse.json(
        { message: "Pet persona not found." },
        { status: 404 }
      );
    }

    const threadKey = `${payload.fromNumber}:${profile.twilioNumber}`;
    const history = await getThreadMessages(threadKey);

    return NextResponse.json({
      threadKey,
      history
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load simulated thread.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

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
    const memories = await listPetMemories(profile.id);

    await appendThreadMessage(threadKey, {
      role: "user",
      body: payload.message
    });

    const reply = await generatePetReply({
      profile,
      incomingMessage: payload.message,
      history,
      memories
    });

    await appendThreadMessage(threadKey, {
      role: "assistant",
      body: reply.text
    });

    const updatedHistory = await getThreadMessages(threadKey);
    const extractedMemories = await extractPetMemories({
      profile,
      incomingMessage: payload.message,
      assistantReply: reply.text,
      history: updatedHistory,
      existingMemories: memories
    });

    let savedMemories = [] as Awaited<ReturnType<typeof upsertPetMemories>>;
    let memorySaveError: string | null = null;

    try {
      savedMemories = await upsertPetMemories(profile.id, extractedMemories);
    } catch (error) {
      memorySaveError =
        error instanceof Error ? error.message : "Unable to save pet memories.";
    }

    const extractedMemoryCount = extractedMemories.length;
    const savedMemoryCount = savedMemories.length;

    return NextResponse.json({
      message:
        reply.source === "openai"
          ? `Simulated SMS exchange created with OpenAI. Extracted ${extractedMemoryCount} memory item${extractedMemoryCount === 1 ? "" : "s"} and saved ${savedMemoryCount}.${memorySaveError ? ` Save error: ${memorySaveError}` : ""}`
          : `Simulated SMS exchange created using fallback reply (${reply.fallbackReason ?? "unknown_reason"}${reply.errorMessage ? `: ${reply.errorMessage}` : ""}). Extracted ${extractedMemoryCount} memory item${extractedMemoryCount === 1 ? "" : "s"} and saved ${savedMemoryCount}.${memorySaveError ? ` Save error: ${memorySaveError}` : ""}`,
      threadKey,
      reply: reply.text,
      replySource: reply.source,
      replyFallbackReason: reply.fallbackReason ?? null,
      replyErrorMessage: reply.errorMessage ?? null,
      history: updatedHistory,
      extractedMemoryCount,
      savedMemoryCount,
      extractedMemories,
      memorySaveError
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to simulate message.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
