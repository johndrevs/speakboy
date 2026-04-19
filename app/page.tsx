import Link from "next/link";
import { PetPersonaManager } from "@/components/pet-persona-manager";
import { PersonaPreview } from "@/components/persona-preview";
import { SmsSimulator } from "@/components/sms-simulator";
import { listPetProfiles } from "@/lib/store";

export const dynamic = "force-dynamic";

const features = [
  "Create a persistent pet persona with quirks, memories, and boundaries.",
  "Connect a Twilio phone number so inbound texts become pet-voiced replies.",
  "Keep a per-thread memory summary so the pet feels consistent over time."
];

export default async function HomePage() {
  const pets = await listPetProfiles();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">SMS-native pet roleplay</p>
          <h1>Your pet gets a phone number and a voice.</h1>
          <p className="lede">
            SpeakBoy lets someone text a dedicated number and receive replies as
            if their dog, cat, or bird were speaking for themselves.
          </p>
          <ul className="feature-list">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <PersonaPreview />
      </section>

      <section className="builder-grid">
        <div className="panel">
          <p className="section-label">Setup</p>
          <h2>Define the pet persona.</h2>
          <p className="section-copy">
            This starter app stores setup data in a local JSON file for now.
            Swap the sample store for Postgres, Supabase, or Prisma when you
            want production-grade persistence.
          </p>
          <PetPersonaManager initialPets={pets} />
        </div>

        <div className="panel muted">
          <p className="section-label">How it works</p>
          <h2>SMS in, persona reply out.</h2>
          <ol className="steps-list">
            <li>User creates a pet profile and assigns a Twilio number.</li>
            <li>Twilio sends inbound SMS payloads to <code>/api/sms/webhook</code>.</li>
            <li>The server pulls the saved persona, thread memory, and last turns.</li>
            <li>OpenAI generates a reply in the pet&apos;s voice.</li>
            <li>Twilio returns the message to the SMS thread.</li>
          </ol>
        </div>
      </section>

      <section className="panel simulator-panel">
        <p className="section-label">Simulation</p>
        <h2>Run the SMS product without carrier approvals.</h2>
        <p className="section-copy">
          Use the built-in simulator to send a mock inbound text, generate the
          pet&apos;s reply, and build thread history without Twilio delivery.
        </p>
        <SmsSimulator pets={pets} />
      </section>

      <section className="panel simulator-panel">
        <p className="section-label">Memory</p>
        <h2>Give your pet a personality bath.</h2>
        <p className="section-copy">
          Open the dedicated memory page to inspect learned long-term memories
          and clear them when you want the pet to start fresh.
        </p>
        <Link className="memory-back-link" href="/memory">
          Open memory bath
        </Link>
      </section>
    </main>
  );
}
