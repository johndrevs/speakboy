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
