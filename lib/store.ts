import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { hasSupabaseConfig, supabaseRequest } from "@/lib/supabase";
import type { PetMemoryItem, PetProfile, ThreadMessage } from "@/lib/types";

type PersistedStore = {
  pets: PetProfile[];
  threads: Record<string, ThreadMessage[]>;
  memories?: PetMemoryItem[];
};

type SupabasePetProfileRow = {
  id: string;
  owner_name: string;
  pet_name: string;
  animal_type: string;
  persona_style: string;
  backstory: string;
  twilio_number: string;
  created_at: string;
};

type SupabaseThreadMessageRow = {
  role: ThreadMessage["role"];
  body: string;
  created_at: string;
};

type SupabasePetMemoryRow = {
  id: string;
  pet_id: string;
  category: PetMemoryItem["category"];
  subject: PetMemoryItem["subject"];
  key: string;
  value: string;
  source: PetMemoryItem["source"];
  confidence: number;
  created_at: string;
  updated_at: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const storePath = path.join(dataDirectory, "store.json");

async function readStore(): Promise<PersistedStore> {
  try {
    const contents = await readFile(storePath, "utf8");
    return JSON.parse(contents) as PersistedStore;
  } catch {
    return {
      pets: [],
      threads: {},
      memories: []
    };
  }
}

async function writeStore(store: PersistedStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function savePetProfile(
  input: Omit<PetProfile, "id" | "createdAt">
): Promise<PetProfile> {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest("/rest/v1/pet_profiles", {
      method: "POST",
      body: JSON.stringify([toSupabasePetProfileFields(input)])
    });

    if (!response.ok) {
      throw await createStoreError(response, "Unable to save pet profile.");
    }

    const rows = (await response.json()) as SupabasePetProfileRow[];
    return toPetProfile(rows[0]);
  }

  const store = await readStore();
  const profile: PetProfile = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  };

  const nextPets = store.pets.filter(
    (pet) => normalizePhone(pet.twilioNumber) !== normalizePhone(profile.twilioNumber)
  );
  nextPets.push(profile);

  await writeStore({
    ...store,
    pets: nextPets
  });

  return profile;
}

export async function updatePetProfile(
  id: string,
  updates: Omit<PetProfile, "id" | "createdAt">
): Promise<PetProfile | null> {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      `/rest/v1/pet_profiles?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: "PATCH",
        body: JSON.stringify(toSupabasePetProfileFields(updates))
      }
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to update pet profile.");
    }

    const rows = (await response.json()) as SupabasePetProfileRow[];
    return rows[0] ? toPetProfile(rows[0]) : null;
  }

  const store = await readStore();
  const existingProfile = store.pets.find((pet) => pet.id === id);

  if (!existingProfile) {
    return null;
  }

  const updatedProfile: PetProfile = {
    ...existingProfile,
    ...updates
  };

  const nextPets = store.pets
    .filter(
      (pet) =>
        pet.id === id ||
        normalizePhone(pet.twilioNumber) !== normalizePhone(updatedProfile.twilioNumber)
    )
    .map((pet) => (pet.id === id ? updatedProfile : pet));

  await writeStore({
    ...store,
    pets: nextPets
  });

  return updatedProfile;
}

export async function findPetByTwilioNumber(number: string) {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      `/rest/v1/pet_profiles?twilio_number=eq.${encodeURIComponent(normalizePhone(number))}&select=*`
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to load pet profile.");
    }

    const rows = (await response.json()) as SupabasePetProfileRow[];
    return rows[0] ? toPetProfile(rows[0]) : null;
  }

  const store = await readStore();
  return (
    store.pets.find(
      (pet) => normalizePhone(pet.twilioNumber) === normalizePhone(number)
    ) ?? null
  );
}

export async function listPetProfiles(): Promise<PetProfile[]> {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      "/rest/v1/pet_profiles?select=*&order=created_at.desc"
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to list pet profiles.");
    }

    const rows = (await response.json()) as SupabasePetProfileRow[];
    return rows.map(toPetProfile);
  }

  const store = await readStore();
  return [...store.pets].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export async function findPetById(id: string) {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      `/rest/v1/pet_profiles?id=eq.${encodeURIComponent(id)}&select=*`
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to load pet profile.");
    }

    const rows = (await response.json()) as SupabasePetProfileRow[];
    return rows[0] ? toPetProfile(rows[0]) : null;
  }

  const store = await readStore();
  return store.pets.find((pet) => pet.id === id) ?? null;
}

export async function getThreadMessages(threadKey: string): Promise<ThreadMessage[]> {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      `/rest/v1/thread_messages?thread_key=eq.${encodeURIComponent(threadKey)}&select=role,body,created_at&order=created_at.desc&limit=12`
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to load thread messages.");
    }

    const rows = (await response.json()) as SupabaseThreadMessageRow[];
    return rows.reverse().map((row) => ({
      role: row.role,
      body: row.body
    }));
  }

  const store = await readStore();
  return store.threads[threadKey] ?? [];
}

export async function appendThreadMessage(
  threadKey: string,
  message: ThreadMessage
) {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest("/rest/v1/thread_messages", {
      method: "POST",
      body: JSON.stringify([
        {
          thread_key: threadKey,
          role: message.role,
          body: message.body
        }
      ])
    });

    if (!response.ok) {
      throw await createStoreError(response, "Unable to save thread message.");
    }

    return;
  }

  const store = await readStore();
  const nextMessages = [...(store.threads[threadKey] ?? []), message].slice(-12);

  await writeStore({
    ...store,
    threads: {
      ...store.threads,
      [threadKey]: nextMessages
    }
  });
}

export async function clearThreadMessages(threadKey: string) {
  if (hasSupabaseConfig()) {
    const response = await supabaseRequest(
      `/rest/v1/thread_messages?thread_key=eq.${encodeURIComponent(threadKey)}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal"
        }
      }
    );

    if (!response.ok) {
      throw await createStoreError(response, "Unable to clear thread messages.");
    }

    return;
  }

  const store = await readStore();
  const nextThreads = { ...store.threads };
  delete nextThreads[threadKey];

  await writeStore({
    ...store,
    threads: nextThreads
  });
}

export async function listPetMemories(petId: string): Promise<PetMemoryItem[]> {
  if (hasSupabaseConfig()) {
    try {
      const response = await supabaseRequest(
        `/rest/v1/pet_memory_items?pet_id=eq.${encodeURIComponent(petId)}&select=*&order=updated_at.desc`
      );

      if (!response.ok) {
        throw await createStoreError(response, "Unable to load pet memories.");
      }

      const rows = (await response.json()) as SupabasePetMemoryRow[];
      return rows.map(toPetMemoryItem);
    } catch (error) {
      console.error("Pet memory table unavailable, continuing without memory", {
        petId,
        error
      });
      return [];
    }
  }

  const store = await readStore();
  return (store.memories ?? [])
    .filter((memory) => memory.petId === petId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertPetMemories(
  petId: string,
  memories: Omit<PetMemoryItem, "id" | "petId" | "createdAt" | "updatedAt">[]
): Promise<PetMemoryItem[]> {
  if (memories.length === 0) {
    return [];
  }

  if (hasSupabaseConfig()) {
    try {
      const payload = memories.map((memory) => ({
        pet_id: petId,
        category: memory.category,
        subject: memory.subject,
        key: memory.key,
        value: memory.value,
        source: memory.source,
        confidence: memory.confidence
      }));

      const response = await supabaseRequest(
        "/rest/v1/pet_memory_items?on_conflict=pet_id,subject,key",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation,resolution=merge-duplicates"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw await createStoreError(response, "Unable to save pet memories.");
      }

      const rows = (await response.json()) as SupabasePetMemoryRow[];
      return rows.map(toPetMemoryItem);
    } catch (error) {
      console.error("Pet memory save failed", {
        petId,
        error
      });
      throw error instanceof Error
        ? error
        : new Error("Unable to save pet memories.");
    }
  }

  const store = await readStore();
  const now = new Date().toISOString();
  const existingMemories = store.memories ?? [];
  const nextMemories = [...existingMemories];
  const touched: PetMemoryItem[] = [];

  for (const memory of memories) {
    const existingIndex = nextMemories.findIndex(
      (item) =>
        item.petId === petId &&
        item.subject === memory.subject &&
        item.key === memory.key
    );

    if (existingIndex >= 0) {
      const existing = nextMemories[existingIndex];
      const updated: PetMemoryItem = {
        ...existing,
        ...memory,
        petId,
        updatedAt: now
      };
      nextMemories[existingIndex] = updated;
      touched.push(updated);
    } else {
      const created: PetMemoryItem = {
        id: randomUUID(),
        petId,
        category: memory.category,
        subject: memory.subject,
        key: memory.key,
        value: memory.value,
        source: memory.source,
        confidence: memory.confidence,
        createdAt: now,
        updatedAt: now
      };
      nextMemories.push(created);
      touched.push(created);
    }
  }

  await writeStore({
    ...store,
    memories: nextMemories
  });

  return touched;
}

export async function clearPetMemories(petId: string) {
  if (hasSupabaseConfig()) {
    try {
      const response = await supabaseRequest(
        `/rest/v1/pet_memory_items?pet_id=eq.${encodeURIComponent(petId)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal"
          }
        }
      );

      if (!response.ok) {
        throw await createStoreError(response, "Unable to clear pet memories.");
      }

      return;
    } catch (error) {
      console.error("Pet memory table unavailable, skipping memory clear", {
        petId,
        error
      });
      return;
    }
  }

  const store = await readStore();
  const nextMemories = (store.memories ?? []).filter((memory) => memory.petId !== petId);

  await writeStore({
    ...store,
    memories: nextMemories
  });
}

export async function deletePetMemory(petId: string, memoryId: string) {
  if (hasSupabaseConfig()) {
    try {
      const response = await supabaseRequest(
        `/rest/v1/pet_memory_items?id=eq.${encodeURIComponent(memoryId)}&pet_id=eq.${encodeURIComponent(petId)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal"
          }
        }
      );

      if (!response.ok) {
        throw await createStoreError(response, "Unable to scrub pet memory.");
      }

      return;
    } catch (error) {
      console.error("Pet memory scrub failed", {
        petId,
        memoryId,
        error
      });
      throw error instanceof Error
        ? error
        : new Error("Unable to scrub pet memory.");
    }
  }

  const store = await readStore();
  const nextMemories = (store.memories ?? []).filter(
    (memory) => !(memory.petId === petId && memory.id === memoryId)
  );

  await writeStore({
    ...store,
    memories: nextMemories
  });
}

function normalizePhone(number: string) {
  return number.replace(/[^\d+]/g, "");
}

function toSupabasePetProfileFields(input: Omit<PetProfile, "id" | "createdAt">) {
  return {
    owner_name: input.ownerName,
    pet_name: input.petName,
    animal_type: input.animalType,
    persona_style: input.personaStyle,
    backstory: input.backstory,
    twilio_number: normalizePhone(input.twilioNumber)
  };
}

function toPetProfile(row: SupabasePetProfileRow): PetProfile {
  return {
    id: row.id,
    ownerName: row.owner_name,
    petName: row.pet_name,
    animalType: row.animal_type,
    personaStyle: row.persona_style,
    backstory: row.backstory,
    twilioNumber: row.twilio_number,
    createdAt: row.created_at
  };
}

function toPetMemoryItem(row: SupabasePetMemoryRow): PetMemoryItem {
  return {
    id: row.id,
    petId: row.pet_id,
    category: row.category,
    subject: row.subject,
    key: row.key,
    value: row.value,
    source: row.source,
    confidence: Number(row.confidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createStoreError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { message?: string; details?: string };
    return new Error(payload.message ?? payload.details ?? fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}
