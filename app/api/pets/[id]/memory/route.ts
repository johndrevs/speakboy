import { NextResponse } from "next/server";

import { clearPetMemories, findPetById, listPetMemories } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const profile = await findPetById(params.id);

  if (!profile) {
    return NextResponse.json({ message: "Pet persona not found." }, { status: 404 });
  }

  const memories = await listPetMemories(profile.id);

  return NextResponse.json({
    memories
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const profile = await findPetById(params.id);

  if (!profile) {
    return NextResponse.json({ message: "Pet persona not found." }, { status: 404 });
  }

  await clearPetMemories(profile.id);

  return NextResponse.json({
    message: "Personality bath complete. Learned memories cleared."
  });
}
