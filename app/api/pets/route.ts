import { NextResponse } from "next/server";
import { z } from "zod";

import { savePetProfile } from "@/lib/store";

export const runtime = "nodejs";

const createPetSchema = z.object({
  ownerName: z.string().min(1),
  petName: z.string().min(1),
  animalType: z.string().min(1),
  personaStyle: z.string().min(1),
  backstory: z.string().min(1),
  twilioNumber: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = createPetSchema.parse(json);
    const profile = await savePetProfile(payload);

    return NextResponse.json({
      message: `Saved ${profile.petName}. Incoming texts to ${profile.twilioNumber} can now use this persona.`,
      profile
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid pet setup payload.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
