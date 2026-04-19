import { NextResponse } from "next/server";
import twilio from "twilio";

import { extractPetMemories } from "@/lib/pet-memory";
import { generatePetReply } from "@/lib/pet-reply";
import {
  appendThreadMessage,
  findPetByTwilioNumber,
  getThreadMessages,
  listPetMemories,
  upsertPetMemories
} from "@/lib/store";
import { validateTwilioRequest } from "@/lib/twilio-request-validator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  );
  const validation = validateTwilioRequest(request, params);

  if (!validation.isValid) {
    return NextResponse.json(
      { message: validation.message },
      {
        status: 403
      }
    );
  }

  const body = String(formData.get("Body") ?? "");
  const from = String(formData.get("From") ?? "");
  const to = String(formData.get("To") ?? "");

  const profile = await findPetByTwilioNumber(to);
  const messagingResponse = new twilio.twiml.MessagingResponse();

  if (!profile) {
    messagingResponse.message(
      "No pet persona is configured for this number yet."
    );
    return new NextResponse(messagingResponse.toString(), {
      headers: {
        "Content-Type": "text/xml"
      }
    });
  }

  const threadKey = `${from}:${to}`;
  const history = await getThreadMessages(threadKey);
  const memories = await listPetMemories(profile.id);

  await appendThreadMessage(threadKey, {
    role: "user",
    body
  });

  const reply = await generatePetReply({
    profile,
    incomingMessage: body,
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
    incomingMessage: body,
    assistantReply: reply.text,
    history: updatedHistory,
    existingMemories: memories
  });
  try {
    await upsertPetMemories(profile.id, extractedMemories);
  } catch (error) {
    console.error("Twilio memory save failed", {
      petId: profile.id,
      error
    });
  }

  messagingResponse.message(reply.text);

  return new NextResponse(messagingResponse.toString(), {
    headers: {
      "Content-Type": "text/xml"
    }
  });
}
