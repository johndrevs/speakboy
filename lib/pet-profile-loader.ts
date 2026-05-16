import { listPetProfiles } from "@/lib/store";
import type { PetProfile } from "@/lib/types";

type PetProfileLoadResult = {
  pets: PetProfile[];
  loadError: string | null;
};

export async function loadPetProfilesForPage(): Promise<PetProfileLoadResult> {
  try {
    return {
      pets: await listPetProfiles(),
      loadError: null
    };
  } catch (error) {
    console.error("Unable to load pet profiles for page render", error);

    return {
      pets: [],
      loadError:
        "SpeakBoy could not load saved pet profiles from its storage backend."
    };
  }
}
