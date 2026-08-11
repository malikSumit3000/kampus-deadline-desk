"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  categories,
  categoryTabs,
  type Agenda,
  type AppView,
  type Category,
  type ModeratorProposal,
  type ReviewItem,
  type StageStatus,
} from "./dashboard-data";
import { agendaAttribution, moderatorActionLabels, reviewActionLabels } from "@/lib/dashboard/presentation";
import { makeManualAgenda } from "@/lib/dashboard/optimistic";
import { mergeSyncResult, type GmailSyncDelta } from "@/lib/dashboard/sync";
import type { ModeratorDecision } from "@/lib/reliability/rpc-contracts";
import AskKampusDrawer from "./AskKampusDrawer";

const navItems: Array<{ id: AppView; label: string; marker: string }> = [
  { id: "dashboard", label: "Deadline runway", marker: "01" },
  { id: "reviews", label: "Review inbox", marker: "02" },
  { id: "moderator", label: "Moderator queue", marker: "03" },
  { id: "privacy", label: "Privacy & account", marker: "04" },
];

const statuses: StageStatus[] = ["to-do", "in progress", "submitted"];

type DashboardData = {
  generatedAt: string;
  profile: { name: string; email: string; role: string };
  agendas: Agenda[];
  progress: Record<string, StageStatus>;
  privateDates: Record<string, string>;
  reviews: ReviewItem[];
  proposals: ModeratorProposal[];
  gmail: { connected: boolean; lastSyncAt: string | null; error: string | null };
  availableCategories: string[];
};

type DashboardDialog =
  | { kind: "category"; agenda?: Agenda }
  | { kind: "delete"; agenda: Agenda }
  | { kind: "gmail" }
  | null;

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [view, setView] = useState<AppView>("dashboard");
  const [category, setCategory] = useState<Category>("All");
  const [agendas, setAgendas] = useState(initialData.agendas);
  const [expanded, setExpanded] = useState<string[]>(initialData.agendas[0] ? [initialData.agendas[0].id] : []);
  const [stageStates, setStageStates] = useState<Record<string, StageStatus>>(
    initialData.progress,
  );
  const [privateDates, setPrivateDates] = useState<Record<string, string>>(initialData.privateDates);
  const [reviews, setReviews] = useState(initialData.reviews);
  const [proposals, setProposals] = useState(initialData.proposals);
  const [availableCategories, setAvailableCategories] = useState(initialData.availableCategories);
  const [lastSync, setLastSync] = useState(initialData.gmail.lastSyncAt ? new Date(initialData.gmail.lastSyncAt).toLocaleString("en-IN") : "Never");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DashboardDialog>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  function applySyncDelta(delta: GmailSyncDelta<Agenda, ReviewItem>) {
    setAgendas((current) => mergeSyncResult({ agendas: current, reviews: [] }, delta).agendas);
    setReviews((current) => mergeSyncResult({ agendas: [], reviews: current }, delta).reviews);
    setLastSync(new Date(delta.lastSyncAt).toLocaleString("en-IN"));
  }

  useEffect(() => {
    if (!initialData.gmail.connected) return;
    const lastSyncAt = initialData.gmail.lastSyncAt ? new Date(initialData.gmail.lastSyncAt).getTime() : 0;
    if (Date.now() - lastSyncAt < 15 * 60 * 1000) return;

    let active = true;
    void fetch("/api/gmail/sync", { method: "POST" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) throw new Error(result.error ?? "Background sync failed");
        applySyncDelta({
          privateAgendas: result.privateAgendas ?? [],
          reviews: result.reviews ?? [],
          lastSyncAt: result.lastSyncAt,
        });
      })
      .catch((error) => active && setNotice(error instanceof Error ? error.message : "Background sync failed"));
    return () => { active = false; };
  }, [initialData.gmail.connected, initialData.gmail.lastSyncAt]);

  const visibleAgendas = useMemo(
    () =>
      category === "All"
        ? agendas
        : agendas.filter((agenda) => agenda.category === category),
    [agendas, category],
  );

  function toggleAgenda(id: string) {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((agendaId) => agendaId !== id)
        : [...current, id],
    );
  }

  function insertAgenda(agenda: Agenda) {
    setAgendas((current) => [...current, agenda].toSorted((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()));
    setExpanded((current) => current.includes(agenda.id) ? current : [agenda.id, ...current]);
  }

  async function refreshInbox() {
    if (!initialData.gmail.connected) {
      window.location.assign("/api/gmail/connect");
      return;
    }
    if (syncing) return;
    setSyncing(true);
    setNotice("Checking new messages received after connection…");
    try {
      const response = await fetch("/api/gmail/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sync failed");
      applySyncDelta({
        privateAgendas: result.privateAgendas ?? [],
        reviews: result.reviews ?? [],
        lastSyncAt: result.lastSyncAt,
      });
      setNotice(`Inbox checked: ${result.scanned} messages scanned, ${result.candidates} possible deadlines found.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function resolveReview(id: string, action: string) {
    const response = await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!response.ok) return setNotice("That review decision could not be saved.");
    setReviews((current) => current.filter((item) => item.id !== id));
    setNotice(`${action}. Your decision was saved.`);
  }

  async function resolveProposal(id: string, action: ModeratorDecision) {
    const response = await fetch(`/api/moderator/proposals/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!response.ok) return setNotice("That moderator decision could not be saved.");
    setProposals((current) => current.filter((item) => item.id !== id));
    const savedLabel = action === "approve" ? "Proposal approved" : action === "private" ? "Proposal marked private" : "Proposal rejected";
    setNotice(`${savedLabel}. The moderator decision was saved.`);
  }

  async function updateStageStatus(stageId: string, status: StageStatus) {
    const previous = stageStates[stageId];
    setStageStates((current) => ({ ...current, [stageId]: status }));
    setPendingAction(`progress:${stageId}`);
    setNotice("Saving progress…");
    try {
      const response = await fetch("/api/progress", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId, status }) });
      if (!response.ok) throw new Error("Progress could not be saved.");
      setNotice("Progress saved.");
    } catch (error) {
      setStageStates((current) => ({ ...current, [stageId]: previous }));
      setNotice(error instanceof Error ? error.message : "Progress could not be saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function updatePrivateDate(stageId: string, deadline: string) {
    const previous = privateDates[stageId];
    setPrivateDates((current) => ({ ...current, [stageId]: deadline }));
    setPendingAction(`date:${stageId}`);
    setNotice("Saving private date…");
    try {
      const response = await fetch("/api/private-dates", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId, deadline: deadline || null }) });
      if (!response.ok) throw new Error("Private date could not be saved.");
      setNotice("Private date saved.");
    } catch (error) {
      setPrivateDates((current) => ({ ...current, [stageId]: previous }));
      setNotice(error instanceof Error ? error.message : "Private date could not be saved.");
    } finally {
      setPendingAction(null);
    }
  }

  async function createManualDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setPendingAction("manual-deadline");
    setNotice("Adding private deadline…");
    const response = await fetch("/api/manual-deadlines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setPendingAction(null);
    if (!response.ok) return setNotice(result.error ?? "Your deadline could not be saved.");
    const agenda = makeManualAgenda({
      ...result.agenda,
      scope: "private",
    });
    insertAgenda(agenda);
    form.reset();
    setShowManualEntry(false);
    setNotice("Private deadline added.");
  }

  async function createSharedAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/moderator/manual-agendas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error ?? "The shared deadline could not be saved.");
    insertAgenda(makeManualAgenda({ ...result.agenda, scope: "shared" }));
    form.reset();
    setNotice("Verified shared deadline published.");
  }

  async function updatePersonalCategory(agenda: Agenda, category: string) {
    const previousCategory = agenda.category;
    setAgendas((current) => current.map((item) => item.id === agenda.id ? { ...item, category } : item));
    setPendingAction(`category:${agenda.id}`);
    setNotice("Saving category…");
    const response = await fetch("/api/personal-categories", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(agenda.scope === "shared" ? { agendaId: agenda.id, category } : { privateAgendaId: agenda.id, category }),
    });
    const result = await response.json();
    setPendingAction(null);
    if (!response.ok) {
      setAgendas((current) => current.map((item) => item.id === agenda.id ? { ...item, category: previousCategory } : item));
      return setNotice(result.error ?? "Category could not be saved.");
    }
    setAvailableCategories((current) => current.includes(category) ? current : [...current, category]);
    setNotice(`Moved to ${category}. Saved.`);
  }

  async function deleteAgenda(agenda: Agenda) {
    setPendingAction(`delete:${agenda.id}`);
    setNotice("Deleting task…");
    const response = await fetch(`/api/agendas/${agenda.id}?scope=${agenda.scope}`, { method: "DELETE" });
    const result = await response.json();
    setPendingAction(null);
    if (!response.ok) return setNotice(result.error ?? "Task could not be deleted.");
    setAgendas((current) => current.filter((item) => item.id !== agenda.id));
    setExpanded((current) => current.filter((id) => id !== agenda.id));
    setDialog(null);
    setNotice("Task deleted.");
  }

  async function createPersonalCategory(category: string, agenda?: Agenda) {
    const trimmed = category.trim();
    if (!trimmed) return setNotice("Enter a category name.");
    setPendingAction("category-create");
    setNotice("Saving category…");
    const response = await fetch("/api/personal-categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: trimmed }),
    });
    const result = await response.json();
    setPendingAction(null);
    if (!response.ok) return setNotice(result.error ?? "Category could not be saved.");
    setAvailableCategories((current) => current.includes(trimmed) ? current : [...current, trimmed]);
    setDialog(null);
    setNotice(`${trimmed} added.`);
    if (agenda) await updatePersonalCategory(agenda, trimmed);
  }

  function exportDemoData() {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        email: initialData.profile.email,
        progress: stageStates,
        privateDates,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "kampus-personal-export.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Your current personal dashboard data was exported.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <button className="brand" onClick={() => setView("dashboard")}>
          <span className="brand-mark">K</span>
          <span>
            <strong>Kampus</strong>
            <small>deadline desk</small>
          </span>
        </button>

        <div className="creator-badge">
          <span>Built by</span>
          <strong>Sumit Malik</strong>
          <small>Class of 2028</small>
        </div>

        <div className="pilot-stamp">
          <span className="live-dot" aria-hidden="true" />
          IIMK private pilot
        </div>

        <nav className="nav-stack">
          <p className="eyebrow">Workspace</p>
          {navItems.filter((item) => item.id !== "moderator" || initialData.profile.role === "moderator").map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span>{item.label}</span>
              <small>
                {item.id === "reviews"
                  ? reviews.length
                  : item.id === "moderator"
                    ? proposals.length
                    : item.marker}
              </small>
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="lock-mark" aria-hidden="true">↳</span>
          <div>
            <strong>Private by construction</strong>
            <p>Read-only scope: gmail.readonly</p>
            <p>Provider retention: up to 30 days</p>
          </div>
        </div>

        <button className="profile-card" onClick={() => setView("privacy")}>
          <span className="avatar">{initialData.profile.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{initialData.profile.name}</strong>
            <small>{initialData.profile.email}</small>
          </span>
          <span aria-hidden="true">•••</span>
        </button>
      </aside>

      <main className="main-canvas">
        <header className="mobile-header">
          <button className="brand" onClick={() => setView("dashboard")}>
            <span className="brand-mark">K</span>
            <strong>Kampus</strong>
          </button>
          <select
            aria-label="Open section"
            value={view}
            onChange={(event) => setView(event.target.value as AppView)}
          >
            {navItems.filter((item) => item.id !== "moderator" || initialData.profile.role === "moderator").map((item) => (
              <option value={item.id} key={item.id}>{item.label}</option>
            ))}
          </select>
        </header>

        {notice && (
          <div className="toast" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
          </div>
        )}

        {view === "dashboard" && (
          <DashboardView
            category={category}
            setCategory={setCategory}
            visibleAgendas={visibleAgendas}
            expanded={expanded}
            toggleAgenda={toggleAgenda}
            stageStates={stageStates}
            updateStageStatus={updateStageStatus}
            privateDates={privateDates}
            updatePrivateDate={updatePrivateDate}
            lastSync={lastSync}
            syncing={syncing}
            refreshInbox={refreshInbox}
            openReviews={() => setView("reviews")}
            reviewCount={reviews.length}
            gmailConnected={initialData.gmail.connected}
            gmailError={initialData.gmail.error}
            createManualDeadline={createManualDeadline}
            availableCategories={availableCategories}
            updatePersonalCategory={updatePersonalCategory}
            openCategoryDialog={(agenda) => setDialog({ kind: "category", agenda })}
            openDeleteDialog={(agenda) => setDialog({ kind: "delete", agenda })}
            canDeleteShared={initialData.profile.role === "moderator"}
            nowMs={new Date(initialData.generatedAt).getTime()}
            pendingAction={pendingAction}
            showManualEntry={showManualEntry}
            setShowManualEntry={setShowManualEntry}
            openGmailDetails={() => setDialog({ kind: "gmail" })}
          />
        )}

        {view === "reviews" && (
          <ReviewView reviews={reviews} resolveReview={resolveReview} />
        )}

        {view === "moderator" && (
          <ModeratorView proposals={proposals} resolveProposal={resolveProposal} createSharedAgenda={createSharedAgenda} />
        )}

        {view === "privacy" && (
          <PrivacyView
            exportDemoData={exportDemoData}
            setNotice={setNotice}
            deleteArmed={deleteArmed}
            setDeleteArmed={setDeleteArmed}
          />
        )}

        <DashboardDialog
          dialog={dialog}
          pendingAction={pendingAction}
          onClose={() => setDialog(null)}
          onCreateCategory={createPersonalCategory}
          onDelete={deleteAgenda}
        />
        <AskKampusDrawer gmailConnected={initialData.gmail.connected} />
      </main>
    </div>
  );
}

type DashboardViewProps = {
  category: Category;
  setCategory: (category: Category) => void;
  visibleAgendas: Agenda[];
  expanded: string[];
  toggleAgenda: (id: string) => void;
  stageStates: Record<string, StageStatus>;
  updateStageStatus: (stageId: string, status: StageStatus) => void;
  privateDates: Record<string, string>;
  updatePrivateDate: (stageId: string, deadline: string) => void;
  lastSync: string;
  syncing: boolean;
  refreshInbox: () => void;
  openReviews: () => void;
  reviewCount: number;
  gmailConnected: boolean;
  gmailError: string | null;
  createManualDeadline: (event: FormEvent<HTMLFormElement>) => void;
  availableCategories: string[];
  updatePersonalCategory: (agenda: Agenda, category: string) => void;
  openCategoryDialog: (agenda?: Agenda) => void;
  openDeleteDialog: (agenda: Agenda) => void;
  canDeleteShared: boolean;
  nowMs: number;
  pendingAction: string | null;
  showManualEntry: boolean;
  setShowManualEntry: (show: boolean) => void;
  openGmailDetails: () => void;
};

function DashboardView({
  category,
  setCategory,
  visibleAgendas,
  expanded,
  toggleAgenda,
  stageStates,
  updateStageStatus,
  privateDates,
  updatePrivateDate,
  lastSync,
  syncing,
  refreshInbox,
  openReviews,
  reviewCount,
  gmailConnected,
  gmailError,
  createManualDeadline,
  availableCategories,
  updatePersonalCategory,
  openCategoryDialog,
  openDeleteDialog,
  canDeleteShared,
  nowMs,
  pendingAction,
  showManualEntry,
  setShowManualEntry,
  openGmailDetails,
}: DashboardViewProps) {
  const dueIn24h = visibleAgendas.filter((agenda) => {
    const remaining = new Date(agenda.deadline).getTime() - nowMs;
    return remaining >= 0 && remaining <= 86_400_000;
  }).length;
  const dueThisWeek = visibleAgendas.filter((agenda) => {
    const remaining = new Date(agenda.deadline).getTime() - nowMs;
    return remaining > 86_400_000 && remaining <= 604_800_000;
  }).length;
  const privateCount = visibleAgendas.filter((agenda) => agenda.scope === "private").length;
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date(nowMs));
  return (
    <div className="page-wrap">
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{today} · Asia/Kolkata</p>
          <h1>Your deadline runway</h1>
          <p className="lede">{visibleAgendas.length} live commitments, ordered around you.</p>
        </div>
        <button className="review-pill" onClick={openReviews}>
          <span>{reviewCount}</span> items need your review <b aria-hidden="true">→</b>
        </button>
      </header>

      <section className="sync-card" aria-label="Gmail connection status">
        <div className="sync-brand"><span>G</span></div>
        <div className="sync-copy">
          <div className="sync-title-row">
            <h2>{gmailConnected ? "Gmail connected" : "Connect Gmail"}</h2>
            <span className={`status-chip ${gmailConnected ? "connected" : "neutral"}`}>{gmailConnected ? "Read only" : "Optional"}</span>
          </div>
          <p>{gmailConnected ? `Last successful sync ${lastSync} · New mail only since connection` : "Website sign-in does not grant inbox access."}</p>
        </div>
        <div className="sync-side">
          <p><span className="health-dot" /> {gmailError ? "Connection needs attention" : gmailConnected ? "Connection healthy" : "Not connected"}</p>
          <button className="button secondary" onClick={refreshInbox} disabled={syncing}>
            {syncing ? "Checking…" : gmailConnected ? "Refresh inbox" : "Connect Gmail"}
          </button>
        </div>
      </section>

      {gmailConnected && <div className="warning-strip" role="note">
        <span aria-hidden="true">!</span>
        <p><strong>Pilot connection:</strong> If the Google Cloud app remains in testing mode, Google may require students to reconnect periodically.</p>
        <button onClick={openGmailDetails}>How it works</button>
      </div>}

      <section className="runway-summary" aria-label="Deadline summary">
        <div><strong>{dueIn24h}</strong><span>due in 24 hours</span></div>
        <div><strong>{dueThisWeek}</strong><span>due this week</span></div>
        <div><strong>{privateCount}</strong><span>private items</span></div>
        <div className="runway-line" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <section className="agenda-section">
        <div className="section-label-row">
          <div>
            <p className="eyebrow">Priority view</p>
            <h2>Upcoming</h2>
          </div>
          <p>Ordered by urgency, then deadline</p>
        </div>

        <div className="tabs" role="tablist" aria-label="Deadline category">
          {categoryTabs(availableCategories).map((item) => (
            <button
              role="tab"
              aria-selected={category === item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              key={item}
            >
              {item}
            </button>
          ))}
          <button type="button" className="category-add-tab" onClick={() => openCategoryDialog()}>+ Category</button>
        </div>

        <div className="agenda-list">
          {visibleAgendas.map((agenda) => {
            const isOpen = expanded.includes(agenda.id);
            return (
              <article className={`agenda-card scope-${agenda.scope}`} key={agenda.id}>
                <button
                  className="agenda-summary"
                  onClick={() => toggleAgenda(agenda.id)}
                  aria-expanded={isOpen}
                >
                  <span className={`urgency urgency-${agenda.urgency}`}>
                    <strong>{agenda.countdown}</strong>
                    <small>{agenda.urgency === "now" ? "left" : "away"}</small>
                  </span>
                  <span className="agenda-main">
                    <span className="agenda-kickers">
                      <span>{agenda.category}</span>
                      <span className={`scope-badge ${agenda.scope}`}>{agenda.scope}</span>
                    </span>
                    <strong className="agenda-title">{agenda.title}</strong>
                    <small>{agenda.detail}</small>
                  </span>
                  <span className="agenda-date">
                    <strong>{agenda.displayDate}</strong>
                    <small>{agenda.stages.length} {agenda.stages.length === 1 ? "stage" : "stages"}</small>
                  </span>
                  <span className="expand-mark" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen && (
                  <div className="agenda-details">
                    <div className="source-row">
                      <span>{agenda.source}</span>
                      <span>{agendaAttribution(agenda)}</span>
                    </div>
                    {agenda.stages.map((stage, index) => (
                      <div className="stage-row" key={stage.id}>
                        <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
                        <div className="stage-copy">
                          <strong>{stage.name}</strong>
                          <span>{stage.note}</span>
                          {privateDates[stage.id] && (
                            <span className="date-conflict">Private override: {privateDates[stage.id]} · Canonical date unchanged</span>
                          )}
                        </div>
                        <div className="stage-controls">
                          <label>
                            <span className="sr-only">Progress for {stage.name}</span>
                            <select
                              value={stageStates[stage.id]}
                              onChange={(event) => updateStageStatus(stage.id, event.target.value as StageStatus)}
                              disabled={pendingAction === `progress:${stage.id}`}
                            >
                              {statuses.map((status) => <option key={status}>{status}</option>)}
                            </select>
                          </label>
                          <label className="date-field">
                            <span>Private date</span>
                            <input
                              type="date"
                              value={privateDates[stage.id] ?? ""}
                              onChange={(event) => updatePrivateDate(stage.id, event.target.value)}
                              disabled={pendingAction === `date:${stage.id}`}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                    <details className="task-manage">
                      <summary>Manage task</summary>
                      <div className="task-manage-controls">
                        <label className="category-control">
                          <span>Personal category</span>
                          <select value={agenda.category} onChange={(event) => updatePersonalCategory(agenda, event.target.value)} disabled={pendingAction === `category:${agenda.id}`}>
                            {availableCategories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}
                          </select>
                        </label>
                        <button type="button" className="text-link category-add" onClick={() => openCategoryDialog(agenda)}>+ Custom category</button>
                        {(agenda.scope === "private" || canDeleteShared) && <button type="button" className="delete-task" onClick={() => openDeleteDialog(agenda)}>Delete task</button>}
                      </div>
                    </details>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="manual-deadline-card manual-deadline-panel" aria-label="Add a private deadline">
        <button
          type="button"
          className="manual-deadline-toggle"
          onClick={() => setShowManualEntry(!showManualEntry)}
          aria-expanded={showManualEntry}
        >
          <span>
            <span className="eyebrow">Personal planning</span>
            <strong>Add a private deadline</strong>
            <small>Visible only to you.</small>
          </span>
          <span aria-hidden="true">{showManualEntry ? "−" : "+"}</span>
        </button>
        {showManualEntry && <ManualDeadlineForm submitLabel={pendingAction === "manual-deadline" ? "Adding…" : "Add private deadline"} onSubmit={createManualDeadline} pending={pendingAction === "manual-deadline"} />}
      </section>
    </div>
  );
}

function ReviewView({
  reviews,
  resolveReview,
}: {
  reviews: ReviewItem[];
  resolveReview: (id: string, action: string) => void;
}) {
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Private to you</p>
          <h1>Review inbox</h1>
          <p className="lede">Nothing enters your runway until you decide.</p>
        </div>
        <span className="count-display">{reviews.length} open</span>
      </header>

      <div className="privacy-banner">
        <span aria-hidden="true">◎</span>
        <p>These items were isolated because they may contain sensitive, conflicting, or uncertain information. Raw attachments are not stored.</p>
      </div>

      <div className="review-list">
        {reviews.length === 0 && <EmptyState title="Inbox cleared" copy="Every uncertain item has a decision." />}
        {reviews.map((item) => (
          <article className="review-card" key={item.id}>
            <div className="review-meta">
              <span className="status-chip warning">{item.kind}</span>
              <small>{item.received}</small>
            </div>
            <h2>{item.title}</h2>
            <p>{item.reason}</p>
            <div className="proposed-date">{item.proposedDate}</div>
            <div className="action-row">
              <button className="button primary" onClick={() => resolveReview(item.id, "Approved")}>{reviewActionLabels[0]}</button>
              <button className="button secondary" onClick={() => resolveReview(item.id, "Correction saved")}>{reviewActionLabels[1]}</button>
              <button className="button ghost" onClick={() => resolveReview(item.id, "Dismissed")}>{reviewActionLabels[2]}</button>
              <a className="text-link" href="https://mail.google.com/" target="_blank" rel="noreferrer">{item.source} ↗</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ModeratorView({
  proposals,
  resolveProposal,
  createSharedAgenda,
}: {
  proposals: ModeratorProposal[];
  resolveProposal: (id: string, action: ModeratorDecision) => void;
  createSharedAgenda: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="page-wrap wide-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Moderator only · shared base</p>
          <h1>Moderator queue</h1>
          <p className="lede">Approve the common fact once. Keep student-specific context private.</p>
        </div>
        <div className="health-mini"><span className="health-dot" /> All systems nominal</div>
      </header>

      <section className="health-grid" aria-label="Pilot health">
        <div><span>Open proposals</span><strong>{proposals.length}</strong></div>
        <div><span>Queue access</span><strong><small>Role-gated</small></strong></div>
        <div><span>Gmail permission</span><strong><small>Read only</small></strong></div>
        <div><span>Raw mail storage</span><strong><small>None</small></strong></div>
      </section>

      <section className="manual-deadline-card moderator-add" aria-label="Publish a verified shared deadline">
        <div>
          <p className="eyebrow">Verified shared base</p>
          <h2>Publish a shared deadline</h2>
          <p>Add only an announcement you have personally verified for the batch.</p>
        </div>
        <ManualDeadlineForm submitLabel="Publish shared deadline" onSubmit={createSharedAgenda} />
      </section>

      <div className="proposal-list">
        {proposals.length === 0 && <EmptyState title="Queue cleared" copy="No shared announcement is waiting for approval." />}
        {proposals.map((proposal) => (
          <article className="proposal-card" key={proposal.id}>
            <div className="proposal-top">
              <div>
                <span className="status-chip neutral">{proposal.action}</span>
                <h2>{proposal.title}</h2>
                <p>{proposal.match}</p>
              </div>
              <div className="confidence-ring">{Math.round(proposal.confidence * 100)}<small>%</small></div>
            </div>
            <div className="diff-grid">
              <div><span>Before</span><p>{proposal.before}</p></div>
              <div className="diff-arrow" aria-hidden="true">→</div>
              <div><span>Proposed</span><p>{proposal.after}</p></div>
            </div>
            <p className="proposal-source">{proposal.source}</p>
            <div className="action-row">
              <button className="button primary" onClick={() => resolveProposal(proposal.id, "approve")}>{moderatorActionLabels[0]}</button>
              <button className="button ghost" onClick={() => resolveProposal(proposal.id, "private")}>{moderatorActionLabels[1]}</button>
              <button className="button danger-text" onClick={() => resolveProposal(proposal.id, "reject")}>{moderatorActionLabels[2]}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ManualDeadlineForm({
  submitLabel,
  onSubmit,
  pending = false,
}: {
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
}) {
  return (
    <form className="manual-deadline-form" onSubmit={onSubmit}>
      <label>Title<input name="title" maxLength={180} required placeholder="e.g. Submit case deck" /></label>
      <label>Category<select name="category" defaultValue="Academics">{categories.filter((category) => category !== "All").map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Deadline<input name="deadline" type="datetime-local" required /></label>
      <label className="manual-notes">Note <input name="detail" maxLength={500} placeholder="Optional context" /></label>
      <button className="button primary" type="submit" disabled={pending}>{submitLabel}</button>
    </form>
  );
}

function DashboardDialog({
  dialog,
  pendingAction,
  onClose,
  onCreateCategory,
  onDelete,
}: {
  dialog: DashboardDialog;
  pendingAction: string | null;
  onClose: () => void;
  onCreateCategory: (category: string, agenda?: Agenda) => Promise<void>;
  onDelete: (agenda: Agenda) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isBusy = pendingAction === "category-create" || (dialog?.kind === "delete" && pendingAction === `delete:${dialog.agenda.id}`);

  useEffect(() => {
    if (!dialog) return;
    const timer = window.setTimeout(() => (dialog.kind === "category" ? inputRef.current : closeRef.current)?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialog, isBusy, onClose]);

  if (!dialog) return null;

  if (dialog.kind === "gmail") {
    return (
      <div className="dialog-backdrop">
        <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="gmail-dialog-title">
          <p className="eyebrow">Gmail permission</p>
          <h2 id="gmail-dialog-title">What Gmail connection allows</h2>
          <p>Kampus reads new mail through Google OAuth using <code>gmail.readonly</code>. It cannot send, edit, or delete messages. Gmail tokens are encrypted server-side.</p>
          <div className="dialog-actions"><button ref={closeRef} className="button primary" type="button" onClick={onClose}>Got it</button></div>
        </section>
      </div>
    );
  }

  if (dialog.kind === "delete") {
    const batchImpact = dialog.agenda.scope === "shared";
    return (
      <div className="dialog-backdrop">
        <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <p className="eyebrow">Confirm deletion</p>
          <h2 id="delete-dialog-title">Delete “{dialog.agenda.title}”?</h2>
          <p>{batchImpact ? "This removes the shared task for the whole batch." : "This removes the private task from your dashboard."}</p>
          <div className="dialog-actions">
            <button ref={closeRef} className="button secondary" type="button" onClick={onClose} disabled={isBusy}>Cancel</button>
            <button className="button danger" type="button" onClick={() => void onDelete(dialog.agenda)} disabled={isBusy}>{isBusy ? "Deleting…" : "Delete task"}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop">
      <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title">
        <form onSubmit={(event) => {
          event.preventDefault();
          const category = String(new FormData(event.currentTarget).get("category") ?? "");
          void onCreateCategory(category, dialog.agenda);
        }}>
          <p className="eyebrow">Personal organization</p>
          <h2 id="category-dialog-title">Add a category</h2>
          <p>{dialog.agenda ? `It will also move “${dialog.agenda.title}” into this personal category.` : "This is visible only in your own dashboard."}</p>
          <label className="dialog-field">Category name<input ref={inputRef} name="category" maxLength={60} required /></label>
          <div className="dialog-actions">
            <button ref={closeRef} className="button secondary" type="button" onClick={onClose} disabled={isBusy}>Cancel</button>
            <button className="button primary" type="submit" disabled={isBusy}>{isBusy ? "Saving…" : "Add category"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PrivacyView({
  exportDemoData,
  setNotice,
  deleteArmed,
  setDeleteArmed,
}: {
  exportDemoData: () => void;
  setNotice: (message: string) => void;
  deleteArmed: boolean;
  setDeleteArmed: (value: boolean) => void;
}) {
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your data, your call</p>
          <h1>Privacy & account</h1>
          <p className="lede">A plain-language view of what this pilot can—and cannot—access.</p>
        </div>
      </header>

      <section className="consent-card">
        <span className="consent-number">01</span>
        <div><h2>Google sign-in is separate from Gmail</h2><p>Your IIMK identity permits access to the pilot. Gmail content is requested only after you explicitly choose Connect Gmail.</p></div>
      </section>
      <section className="consent-card">
        <span className="consent-number">02</span>
        <div><h2>Read-only, new-mail-only processing</h2><p>The requested scope is <code>gmail.readonly</code>. Processing begins after your connection date; this pilot does not import an older dashboard.</p></div>
      </section>
      <section className="consent-card">
        <span className="consent-number">03</span>
        <div><h2>Model provider processing</h2><p>Only bounded message text is sent for deadline extraction. Raw message text and attachments are not stored by Kampus; provider handling follows the API terms configured for this deployment.</p></div>
      </section>

      <section className="account-actions">
        <div>
          <h2>Account controls</h2>
          <p>Export your personal state, disconnect Gmail, or sign out of this browser.</p>
        </div>
        <button className="button secondary" onClick={exportDemoData}>Export my data</button>
        <form action="/api/gmail/disconnect" method="post"><button className="button secondary" type="submit">Disconnect Gmail</button></form>
        <form action="/api/auth/signout" method="post"><button className="button ghost" type="submit">Sign out</button></form>
      </section>

      <section className="danger-zone">
        <div><h2>Delete account permanently</h2><p>Production deletion will remove private overlays, progress, reviews, and encrypted credentials while preserving anonymised shared announcements.</p></div>
        <button
          className="button danger"
          onClick={() => {
            if (deleteArmed) {
              void fetch("/api/account", { method: "DELETE" }).then((response) => {
                if (response.ok) window.location.assign("/login?error=Your+account+was+deleted");
                else setNotice("Account deletion failed. Nothing was removed.");
              });
              setDeleteArmed(false);
            } else {
              setDeleteArmed(true);
            }
          }}
        >
          {deleteArmed ? "Confirm permanent deletion" : "Delete account"}
        </button>
      </section>

      <p className="fine-print">Production access requires an IIMK-owned internal Google Cloud project, Workspace-admin approval, encrypted server-only refresh-token storage, and an allowlist of verified @iimk.ac.in accounts.</p>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">✓</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
