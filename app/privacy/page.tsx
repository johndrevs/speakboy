import Link from "next/link";

export const metadata = {
  title: "SpeakBoy Privacy Policy",
  description: "Privacy policy for SpeakBoy."
};

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <section className="panel compliance-panel">
        <p className="section-label">Privacy Policy</p>
        <h1 className="compliance-title">SpeakBoy Privacy Policy</h1>
        <p className="section-copy">
          SpeakBoy is operated by John Drevs. This page describes how SpeakBoy
          handles contact details, pet persona content, and messaging data for
          the SpeakBoy SMS experience.
        </p>

        <section className="compliance-grid">
          <article className="compliance-card">
            <h2>Information collected</h2>
            <p>
              SpeakBoy may collect your name, mobile number, pet persona setup
              details, and message history needed to operate your conversational
              pet thread.
            </p>
          </article>

          <article className="compliance-card">
            <h2>How information is used</h2>
            <p>
              SpeakBoy uses this information to create your pet persona, send
              and receive SMS messages you requested, maintain thread context,
              and provide customer support.
            </p>
          </article>

          <article className="compliance-card">
            <h2>SMS consent</h2>
            <p>
              Mobile numbers and SMS opt-in consent are used only for the
              SpeakBoy messaging program. SpeakBoy does not sell or share mobile
              opt-in data or consent with third parties for their marketing or
              promotional purposes.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Opt-out</h2>
            <p>
              You can opt out of SMS messaging at any time by replying
              <code> STOP</code>. You can reply <code>HELP</code> for support
              within the thread.
            </p>
          </article>
        </section>

        <section className="compliance-card">
          <h2>Support</h2>
          <p>
            For privacy or messaging questions, use the SpeakBoy support flow on
            the site or reply <code>HELP</code> within a SpeakBoy message
            thread.
          </p>
        </section>

        <div className="compliance-link-row">
          <Link className="memory-back-link" href="/terms">
            Terms
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
