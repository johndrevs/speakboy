import Link from "next/link";

export const metadata = {
  title: "SpeakBoy Terms of Service",
  description: "Terms of service for SpeakBoy."
};

export default function TermsPage() {
  return (
    <main className="page-shell">
      <section className="panel compliance-panel">
        <p className="section-label">Terms of Service</p>
        <h1 className="compliance-title">SpeakBoy Terms of Service</h1>
        <p className="section-copy">
          These terms govern the use of SpeakBoy, an SMS-based AI pet persona
          experience operated by John Drevs.
        </p>

        <section className="compliance-grid">
          <article className="compliance-card">
            <h2>Program description</h2>
            <p>
              SpeakBoy lets a user interact with an AI-generated pet persona
              through one-to-one text messaging. Message frequency varies based
              on the conversation the user initiates.
            </p>
          </article>

          <article className="compliance-card">
            <h2>User consent</h2>
            <p>
              By providing a phone number and requesting a SpeakBoy thread, you
              agree to receive conversational SMS messages from SpeakBoy. Message
              and data rates may apply.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Opt-out and help</h2>
            <p>
              Reply <code>STOP</code> to opt out of future messages. Reply
              <code>HELP</code> for support.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Acceptable use</h2>
            <p>
              SpeakBoy may not be used for spam, phishing, harassment,
              deceptive messaging, or any prohibited marketing or lead
              generation activity.
            </p>
          </article>
        </section>

        <div className="compliance-link-row">
          <Link className="memory-back-link" href="/privacy">
            Privacy
          </Link>
          <Link className="memory-back-link" href="/opt-in">
            SMS Opt-In
          </Link>
          <Link className="memory-back-link" href="/compliance">
            Compliance
          </Link>
        </div>
      </section>
    </main>
  );
}
