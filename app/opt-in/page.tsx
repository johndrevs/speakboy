import Link from "next/link";

export const metadata = {
  title: "SpeakBoy SMS Opt-In",
  description: "Public opt-in and consent flow for SpeakBoy messaging."
};

const disclosures = [
  "Message frequency varies based on the conversation you start with your pet persona.",
  "Message and data rates may apply.",
  "Reply STOP to opt out.",
  "Reply HELP for help."
];

export default function OptInPage() {
  return (
    <main className="page-shell">
      <section className="panel compliance-panel">
        <p className="section-label">Public Opt-In</p>
        <h1 className="compliance-title">Start a SpeakBoy SMS pet thread</h1>
        <p className="section-copy">
          This public page shows the web-based opt-in flow used before a user
          starts a SpeakBoy pet-texting thread. SpeakBoy is operated by John
          Drevs and provides one-to-one conversational SMS for users
          interacting with their own AI pet persona.
        </p>
        <p className="helper-text">
          Support:
          <a href="mailto:speakboyhelp@gmail.com"> speakboyhelp@gmail.com</a>
        </p>

        <section className="compliance-card">
          <h2>Web form opt-in flow</h2>
          <p>
            A user requests a SpeakBoy pet thread by submitting their mobile
            number and separately consenting to receive SMS messages from
            SpeakBoy.
          </p>

          <form className="form-grid compliance-form-preview">
            <label>
              Full name
              <input placeholder="John Drevs" readOnly value="" />
            </label>

            <label>
              Mobile phone number
              <input placeholder="+1 312 555 1212" readOnly value="" />
            </label>

            <label>
              Pet name
              <input placeholder="Bear" readOnly value="" />
            </label>

            <label className="checkbox-row">
              <input checked readOnly type="checkbox" />
              <span>
                I agree to receive SMS/text messages from SpeakBoy at the phone
                number I provided about my pet persona thread.
              </span>
            </label>

            <p className="helper-text compliance-disclosure">
              By tapping &quot;Start my pet thread,&quot; I agree to receive SMS
              text messages from SpeakBoy about my pet persona conversation.
              Message frequency varies. Message and data rates may apply. Reply
              STOP to opt out and HELP for help. Consent is not a condition of
              purchase.
            </p>

            <p className="helper-text">
              By continuing, you also acknowledge the separate
              <Link href="/privacy"> Privacy Policy</Link> and
              <Link href="/terms"> Terms of Service</Link>.
            </p>

            <div className="form-actions">
              <button disabled type="button">
                Start my pet thread
              </button>
            </div>
          </form>
        </section>

        <section className="compliance-grid">
          <article className="compliance-card">
            <h2>What the user is opting into</h2>
            <p>
              SpeakBoy sends conversational one-to-one SMS replies from the pet
              persona the user created or requested. Messages include pet thread
              replies, limited support responses, and requested follow-up
              messages related to the user&apos;s own conversation. Messages are
              not affiliate marketing, lead generation, or third-party
              promotions.
            </p>
          </article>

          <article className="compliance-card">
            <h2>Required disclosures</h2>
            <ul className="feature-list">
              {disclosures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="compliance-card">
          <h2>Related public pages</h2>
          <p>
            Reviewers can use these pages to validate the business website,
            messaging program, and consumer disclosures.
          </p>
          <div className="compliance-link-row">
            <Link className="memory-back-link" href="/">
              Homepage
            </Link>
            <Link className="memory-back-link" href="/compliance">
              Compliance
            </Link>
            <Link className="memory-back-link" href="/privacy">
              Privacy
            </Link>
            <Link className="memory-back-link" href="/terms">
              Terms
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
