import { IMessageDemo } from "@/components/imessage-demo";
import { listPetProfiles } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SpeakBoy iMessage Demo",
  description: "A mobile-first iPhone-style demo for simulated pet texting."
};

export default async function IMessagePage() {
  const pets = await listPetProfiles();

  return (
    <main className="imessage-page">
      <IMessageDemo pets={pets} />
    </main>
  );
}
