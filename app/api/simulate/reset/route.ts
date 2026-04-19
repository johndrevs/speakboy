import { NextResponse } from "next/server";
import { z } from "zod";

import { clearThreadMessages, findPetById } from "@/lib/store";

export const runtime = "nodejs";

const resetSchema = z.object({
  petId: z.string().min(1),
  fromNumber: z.string().min(7)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = resetSchema.parse(json);
    const profile = await findPetById(payload.petId);

    if (!profile) {
      return NextResponse.json(
        { message: "Pet persona not found." },
        { status: 404 }
      );
    }

    const threadKey = `${payload.fromNumber}:${profile.twilioNumber}`;
    await clearThreadMessages(threadKey);

    return NextResponse.json({
      message: "Thread reset.",
      threadKey
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset thread.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
