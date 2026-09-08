export const metadata = {
  title: "Privacy Policy — NFL Over/Unders",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Last updated September 2026.</p>
      </div>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">Who this is for</h2>
        <p>
          This site runs a private, invite-only season-long NFL prediction contest for a small
          group of personal friends. It is not a public product, and it does not collect data
          from, or send messages to, anyone outside that group.
        </p>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          What we collect
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Name and email address, used to create your account and identify your picks.</li>
          <li>
            Phone number (optional), used only to add you to a group text thread with draft and
            score updates. You provide this yourself, or ask the contest organizer to add it on
            your behalf — either way, it is only added with your knowledge and consent.
          </li>
          <li>Your draft picks, division predictions, and tiebreaker guess for the contest.</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          How we use it
        </h2>
        <p>
          Your information is used solely to run the contest: tracking picks and scores, showing
          standings to the other participants, and — if you&apos;ve provided a phone number —
          sending you SMS/MMS updates about the draft (e.g. when it&apos;s your turn, when a pick
          is made, when the draft or season ends) through Twilio, our messaging provider. We do
          not use your information for marketing, and we do not sell or share it with any other
          third party.
        </p>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          SMS/MMS messaging terms
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>No sharing of mobile information:</strong> your mobile phone number and any
            SMS/MMS opt-in consent are never shared or sold to any third party for marketing or
            promotional purposes. Your number is used only to deliver contest updates to you.
          </li>
          <li>
            <strong>Message frequency:</strong> message frequency varies with contest activity —
            typically a handful of messages during the live draft, plus occasional updates during
            the season. No recurring or scheduled messages are sent outside of contest events.
          </li>
          <li>
            <strong>Message and data rates may apply.</strong>
          </li>
          <li>
            Reply <strong>STOP</strong> at any time to stop receiving messages, or{" "}
            <strong>HELP</strong> for assistance. You can also opt out by removing your phone
            number from your profile (see below).
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Who can see it
        </h2>
        <p>
          Only the other participants in your contest (a small, fixed group of about 5 people)
          and the contest organizer can see your name, picks, and standings. Your phone number is
          never shown to other participants — it is only used internally to deliver text
          messages.
        </p>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Opting out of text messages
        </h2>
        <p>
          You can stop receiving texts at any time by removing your phone number from your
          profile (or asking the organizer to remove it for you). Doing so does not affect your
          participation in the contest itself.
        </p>
      </section>

      <section className="space-y-2 text-sm text-ink">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">Contact</h2>
        <p>
          Questions about your data? Contact the contest organizer directly — they administer
          this site and can answer or act on any request.
        </p>
      </section>
    </main>
  );
}
