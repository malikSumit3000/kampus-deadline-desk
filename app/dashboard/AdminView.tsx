"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminAccount } from "@/lib/admin/accounts";

type AdminDialog = { kind: "block" | "remove"; account: AdminAccount } | null;

function dateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default function AdminView({ currentUserId, setNotice }: { currentUserId: string; setNotice: (message: string) => void }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<AdminDialog>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => { pendingRef.current = pending; }, [pending]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/accounts")
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!response.ok) throw new Error(result.error ?? "Account status could not be loaded.");
        if (active) setAccounts(result.accounts ?? []);
      })
      .catch((error) => active && setNotice(error instanceof Error ? error.message : "Account status could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [setNotice]);

  useEffect(() => {
    if (!dialog) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) setDialog(null);
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKeyDown); previousFocusRef.current?.focus(); };
  }, [dialog]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? accounts.filter((account) => `${account.name} ${account.email} ${account.role} ${account.status}`.toLowerCase().includes(needle)) : accounts;
  }, [accounts, query]);
  const stats = {
    total: accounts.length,
    active: accounts.filter((account) => account.status === "active").length,
    blocked: accounts.filter((account) => account.status === "blocked").length,
    gmail: accounts.filter((account) => account.gmailConnected).length,
    errors: accounts.filter((account) => account.syncErrorCode).length,
  };

  async function changeStatus(account: AdminAccount, action: "block" | "unblock") {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Account status could not be changed.");
      const status = action === "block" ? "blocked" : "active";
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status, gmailConnected: action === "block" ? false : item.gmailConnected } : item));
      setDialog(null);
      setNotice(action === "block" ? `${account.name} is blocked and Gmail was disconnected.` : `${account.name} can access Kampus again. Gmail must be reconnected.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Account status could not be changed.");
    } finally { setPending(false); }
  }

  async function removeAccount(account: AdminAccount) {
    setPending(true);
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmationEmail }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Account could not be permanently removed.");
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setDialog(null); setConfirmationEmail("");
      setNotice(`${account.name}'s account was permanently removed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Account could not be permanently removed.");
    } finally { setPending(false); }
  }

  return <div className="page-wrap admin-page">
    <header className="page-header"><p className="eyebrow">Administrator only</p><h1>Account monitor</h1><p>Operational account health without inbox or task content.</p></header>
    <section className="admin-stats" aria-label="Account summary">
      <div className="admin-stat-total"><span>Total</span><strong>{stats.total}</strong></div><div><span>Active</span><strong>{stats.active}</strong></div><div><span>Blocked</span><strong>{stats.blocked}</strong></div><div><span>Gmail connected</span><strong>{stats.gmail}</strong></div><div><span>Sync errors</span><strong>{stats.errors}</strong></div>
    </section>
    <section className="admin-account-panel">
      <div className="admin-toolbar"><div><h2>Student accounts</h2><p>Showing up to 200 accounts.</p></div><label>Search accounts<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or IIMK email" /></label></div>
      {loading ? <p className="admin-loading" role="status">Loading account status…</p> : visible.length === 0 ? <p className="admin-loading">No matching accounts.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Account</th><th>Status</th><th>Gmail / sync</th><th>Private work</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{visible.map((account) => {
        const protectedAccount = account.id === currentUserId || account.isAdmin;
        return <tr key={account.id}><td><strong>{account.name}</strong><span>{account.email}</span><small>{account.role}{account.isAdmin ? " · admin" : ""}</small></td><td><span className={`account-status ${account.status}`}>{account.status}</span></td><td><strong>{account.gmailConnected ? "Connected" : "Disconnected"}</strong><span>Last sync: {dateTime(account.lastSyncAt)}</span>{account.syncErrorCode && <small className="sync-error">{account.syncErrorCode}</small>}</td><td><span>{account.privateTaskCount} private tasks</span><span>{account.openReviewCount} open reviews</span></td><td>{dateTime(account.joinedAt)}</td><td>{protectedAccount ? <span className="protected-account">Protected admin</span> : <div className="admin-row-actions">{account.status === "active" ? <button type="button" onClick={() => setDialog({ kind: "block", account })}>Block account</button> : <button type="button" onClick={() => void changeStatus(account, "unblock")}>Unblock account</button>}<button className="danger-link" type="button" onClick={() => { setConfirmationEmail(""); setDialog({ kind: "remove", account }); }}>Permanently remove</button></div>}</td></tr>;
      })}</tbody></table></div>}
    </section>
    {dialog && <div className="dialog-backdrop"><section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <p className="eyebrow">Administrator action</p><h2 id="admin-dialog-title">{dialog.kind === "block" ? `Block ${dialog.account.name}?` : `Permanently remove ${dialog.account.name}?`}</h2>
      {dialog.kind === "block" ? <p>This immediately blocks Kampus access and disconnects Gmail. Private tasks are preserved for a later unblock.</p> : <><p>This deletes the account and its private data. Shared deadlines remain with anonymized creator attribution.</p><label className="dialog-field">Type {dialog.account.email} to confirm<input value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} autoComplete="off" /></label></>}
      <div className="dialog-actions"><button ref={cancelRef} className="button secondary" type="button" onClick={() => setDialog(null)} disabled={pending}>Cancel</button>{dialog.kind === "block" ? <button className="button danger" type="button" onClick={() => void changeStatus(dialog.account, "block")} disabled={pending}>{pending ? "Blocking…" : "Block account"}</button> : <button className="button danger" type="button" onClick={() => void removeAccount(dialog.account)} disabled={pending || confirmationEmail.trim() !== dialog.account.email}>{pending ? "Removing…" : "Permanently remove"}</button>}</div>
    </section></div>}
  </div>;
}
