import Link from "next/link";

import { PetMemoryInspector } from "@/components/pet-memory-inspector";
import { listPetProfiles } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SpeakBoy Memory Bath",
  description: "Inspect and clear what your pet has learned from conversation."
};

export default async function MemoryPage() {
  const pets = await listPetProfiles();

  return (
    <main className="page-shell memory-page-shell">
      <section className="panel memory-hero-panel">
        <div className="memory-hero-copy">
          <p className="section-label">Memory Bath</p>
          <h1>Inspect what your pet thinks it knows.</h1>
          <p className="section-copy">
            SpeakBoy builds long-term memory from what the owner teaches the pet
            in conversation. If the pet starts sounding off, give it a
            personality bath and reset the learned memories.
          </p>
          <p className="helper-text">
            Only learned memory is cleared here. The core persona setup stays in
            place.
          </p>
          <Link className="memory-back-link" href="/">
            Back to home
          </Link>
        </div>
      </section>

      <section className="panel memory-inspector-panel">
        <PetMemoryInspector pets={pets} />
      </section>
    </main>
  );
}
