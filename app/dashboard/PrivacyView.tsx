"use client";

export default function PrivacyView({ exportDemoData, setNotice, deleteArmed, setDeleteArmed }: {
  exportDemoData: () => void;
  setNotice: (message: string) => void;
  deleteArmed: boolean;
  setDeleteArmed: (value: boolean) => void;
}) {
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">Your data, your call</p><h1>Privacy & account</h1><p className="lede">A plain-language view of what this pilot can—and cannot—access.</p></div></header>
      <section className="consent-card"><span className="consent-number">01</span><div><h2>Google sign-in is separate from Gmail</h2><p>Your IIMK identity permits access to the pilot. Gmail content is requested only after you explicitly choose Connect Gmail.</p></div></section>
      <section className="consent-card"><span className="consent-number">02</span><div><h2>Read-only, new-mail-only processing</h2><p>The requested scope is <code>gmail.readonly</code>. Processing begins after your connection date; this pilot does not import an older dashboard.</p></div></section>
      <section className="consent-card"><span className="consent-number">03</span><div><h2>Model provider processing</h2><p>Only bounded message text is sent for deadline extraction. Raw message text and attachments are not stored by Kampus; provider handling follows the API terms configured for this deployment.</p></div></section>
      <section className="account-actions">
        <div><h2>Account controls</h2><p>Export your personal state, disconnect Gmail, or sign out of this browser.</p></div>
        <button className="button secondary" onClick={exportDemoData}>Export my data</button>
        <form action="/api/gmail/disconnect" method="post"><button className="button secondary" type="submit">Disconnect Gmail</button></form>
        <form action="/api/auth/signout" method="post"><button className="button ghost" type="submit">Sign out</button></form>
      </section>
      <section className="danger-zone">
        <div><h2>Delete account permanently</h2><p>Production deletion will remove private overlays, progress, reviews, and encrypted credentials while preserving anonymised shared announcements.</p></div>
        <button className="button danger" onClick={() => {
          if (deleteArmed) {
            void fetch("/api/account", { method: "DELETE" }).then((response) => {
              if (response.ok) window.location.assign("/login?error=Your+account+was+deleted");
              else setNotice("Account deletion failed. Nothing was removed.");
            });
            setDeleteArmed(false);
          } else setDeleteArmed(true);
        }}>{deleteArmed ? "Confirm permanent deletion" : "Delete account"}</button>
      </section>
      <p className="fine-print">Production access requires an IIMK-owned internal Google Cloud project, Workspace-admin approval, encrypted server-only refresh-token storage, and an allowlist of verified @iimk.ac.in accounts.</p>
    </div>
  );
}
