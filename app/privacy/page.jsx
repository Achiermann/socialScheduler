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


      <h2>YouTube API Services</h2>
      <p>
        The Service uses <strong>YouTube API Services</strong> to upload the operator&apos;s own
        videos to the operator&apos;s own YouTube channel. By connecting a YouTube channel to the
        Service, the operator agrees to be bound by the{" "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
          YouTube Terms of Service
        </a>.
      </p>
      <p>
        Google&apos;s handling of data is described in the{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Google Privacy Policy
        </a>.
      </p>

      <h2>What YouTube data the Service accesses</h2>
      <p>
        The Service requests a single OAuth scope,
        <code> https://www.googleapis.com/auth/youtube.upload</code>, which permits uploading videos
        only. It uses exactly one API endpoint, <code>videos.insert</code>.
      </p>
      <ul>
        <li>
          It <strong>does not</strong> read, retrieve, cache or display any YouTube content,
          analytics, comments, subscriber information or channel data.
        </li>
        <li>
          It <strong>does not</strong> access any channel other than the one the operator explicitly
          connected, and has no access to other YouTube users&apos; data.
        </li>
        <li>
          The only YouTube-derived data stored is the <strong>video ID</strong> returned after a
          successful upload, recorded so the Service knows the upload completed. No other YouTube
          data is stored.
        </li>
        <li>
          OAuth tokens issued by Google are stored encrypted at rest in the operator&apos;s own
          database and are used exclusively to perform these uploads. They are never shared with
          third parties.
        </li>
      </ul>

      <h2>Revoking access and deleting data</h2>
      <p>
        The operator can revoke the Service&apos;s access to their YouTube account at any time via
        the{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          Google security settings page
        </a>
        . Revocation takes effect immediately and permanently prevents further uploads.
      </p>
      <p>
        Stored video IDs and OAuth tokens can be deleted by the operator at any time by removing the
        corresponding records from the database; they are deleted automatically when the Service is
        decommissioned. Uploaded videos themselves are managed by the operator in YouTube Studio and
        can be deleted there. The Service retains no other YouTube data, so no further deletion is
        applicable.
      </p>

      <h2>Contact</h2>
      <p>Requests regarding this policy can be directed to the operator of this installation.</p>
    </main>
  );
}
