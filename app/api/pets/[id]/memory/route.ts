import { NextResponse } from "next/server";

import {
  clearPetMemories,
  deletePetMemory,
  findPetById,
  listPetMemories
} from "@/lib/store";

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
  request: Request,
  { params }: { params: { id: string } }
) {
  const profile = await findPetById(params.id);

  if (!profile) {
    return NextResponse.json({ message: "Pet persona not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const memoryId = url.searchParams.get("memoryId");

  if (memoryId) {
    await deletePetMemory(profile.id, memoryId);

    return NextResponse.json({
      message: "Memory scrubbed."
    });
  }

  await clearPetMemories(profile.id);

  return NextResponse.json({
    message: "Personality bath complete. Learned memories cleared."
  });
}
