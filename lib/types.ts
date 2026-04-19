export type PetProfile = {
  id: string;
  ownerName: string;
  petName: string;
  animalType: string;
  personaStyle: string;
  backstory: string;
  twilioNumber: string;
  createdAt: string;
};

export type ThreadMessage = {
  role: "user" | "assistant";
  body: string;
};

export type PetMemoryItem = {
  id: string;
  petId: string;
  category: "identity" | "relationship" | "preference" | "routine" | "biography";
  subject: "self" | "owner" | "other";
  key: string;
  value: string;
  source:
    | "told_by_owner"
    | "observed_in_conversation"
    | "inferred_from_pattern"
    | "expressed_by_pet";
  confidence: number;
  createdAt: string;
  updatedAt: string;
};
