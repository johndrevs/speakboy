import { NextResponse } from "next/server";
import { z } from "zod";

import { updatePetProfile } from "@/lib/store";

export const runtime = "nodejs";

const updatePetSchema = z.object({
  ownerName: z.string().min(1),
  petName: z.string().min(1),
  animalType: z.string().min(1),
  personaStyle: z.string().min(1),
  backstory: z.string().min(1),
  twilioNumber: z.string().min(8)
});

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const json = await request.json();
    const payload = updatePetSchema.parse(json);
    const profile = await updatePetProfile(params.id, payload);

    if (!profile) {
      return NextResponse.json(
        { message: "Pet persona not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `Updated ${profile.petName}.`,
      profile
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid pet setup payload.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
