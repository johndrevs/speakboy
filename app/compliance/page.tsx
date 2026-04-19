export const metadata = {
  title: "SpeakBoy Messaging Compliance",
  description: "Messaging opt-in, consent, and support details for SpeakBoy."
};

const sampleMessages = [
  "Bear here. I am on couch patrol and taking my responsibilities seriously.",
  "You left for work and I have logged a formal complaint, but I still love you.",
  "I heard the treat bag. Please confirm this is not a drill."
];

export default function CompliancePage() {
  return (
    <main className="page-shell">
      <section className="panel compliance-panel">
        <p className="section-label">Messaging Compliance</p>
        <h1 className="compliance-title">SpeakBoy SMS Consent Details</h1>
        <p className="section-copy">
          SpeakBoy is an SMS application that lets a user interact with an AI
          pet persona they created. Messaging is conversational, one-to-one,
          and user-initiated.
        </p>

        <div className="compliance-grid">
          <article className="compliance-card">
            <h2>Opt-in</h2>
            <p>
              Users opt in by sending the first text message to the dedicated
              SpeakBoy phone number assigned to their pet persona experience.
            </p>
            <p>
              SpeakBoy does not add users from purchased lists, uploaded phone
              lists, or unsolicited outreach campaigns.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Consent</h2>
            <p>
              Consent is established when the user initiates the conversation by
              texting the number first. Messages are then sent only as replies
              within that conversation.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Opt-out</h2>
            <p>
              Users can opt out at any time by replying <code>STOP</code>.
              Standard carrier opt-out behavior is honored.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Help</h2>
            <p>
              Users can reply <code>HELP</code> for assistance with the
              SpeakBoy messaging experience.
            </p>
          </article>
        </div>

        <section className="compliance-card">
          <h2>Message Use Case</h2>
          <p>
            SpeakBoy messages are low-volume conversational responses for a
            user interacting with an AI pet persona. The service is not used
            for cold outreach, affiliate marketing, political messaging, lead
            generation, or unsolicited bulk campaigns.
          </p>
        </section>

        <section className="compliance-card">
          <h2>Sample Messages</h2>
          <ul className="feature-list">
            {sampleMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>

        <section className="compliance-card">
          <h2>Support Contact</h2>
          <p>
            For support questions about SpeakBoy messaging, users can reply
            <code> HELP</code> within the SMS conversation.
          </p>
        </section>
      </section>
    </main>
  );
}
