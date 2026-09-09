export const metadata = { title: "Privacy Policy – Social Scheduler" };

export default function Privacy() {
  return (
    <main className="legal">
      <h1>Privacy Policy</h1>
      <p><em>Last updated: September 2026</em></p>

      <p>
        Social Scheduler (&quot;the Service&quot;) is a private, single-operator tool. It has no public
        user registration and collects no personal data from visitors.
      </p>

      <h2>What data is processed</h2>
      <ul>
        <li>
          <strong>Video files and metadata:</strong> filenames, captions, scheduled publishing dates
          and internal notes, created by the operator and stored in the operator&apos;s own database
          (Supabase). Video files remain in the operator&apos;s own Dropbox account.
        </li>
        <li>
          <strong>API access tokens:</strong> tokens issued by Instagram, TikTok and YouTube when the
          operator connects their own accounts. They are stored encrypted at rest in the
          operator&apos;s database and are used exclusively to upload the operator&apos;s own videos.
        </li>
        <li>
          <strong>Session cookie:</strong> a single technical cookie storing a hash of the access
          code, used only to keep the operator signed in. No analytics, tracking or advertising
          cookies are used.
        </li>
      </ul>

      <h2>What data is not processed</h2>
      <p>
        The Service does not read, collect or store data about other users, followers, comments or
        messages, and does not share any data with third parties beyond the platform APIs strictly
        required to publish the operator&apos;s own content.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Data is retained for as long as the operator runs the Service. Access tokens can be revoked at
        any time in the respective platform&apos;s settings, which immediately ends the
        Service&apos;s access. All stored data can be deleted by the operator at any time.
      </p>

      <h2>Contact</h2>
      <p>Requests regarding this policy can be directed to the operator of this installation.</p>
    </main>
  );
}
