import { IMessageDemo } from "@/components/imessage-demo";
import { loadPetProfilesForPage } from "@/lib/pet-profile-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SpeakBoy iMessage Demo",
  description: "A mobile-first iPhone-style demo for simulated pet texting."
};

export default async function IMessagePage() {
  const { pets, loadError } = await loadPetProfilesForPage();

  return (
    <main className="imessage-page">
      {loadError ? (
        <section className="panel">
          <p className="section-label">Storage issue</p>
          <h2>Saved pet profiles are temporarily unavailable.</h2>
          <p className="section-copy">
            {loadError} The demo will remain empty until production storage is
            reachable again.
          </p>
        </section>
      ) : null}

      <IMessageDemo pets={pets} />
    </main>
  );
}
