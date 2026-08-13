"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  type Agenda,
  type AppView,
  type Category,
  type ModeratorProposal,
  type ReviewItem,
  type StageStatus,
} from "./dashboard-data";
import { makeManualAgenda } from "@/lib/dashboard/optimistic";
import { mergeSyncResult, type GmailSyncDelta } from "@/lib/dashboard/sync";
import type { ModeratorDecision } from "@/lib/reliability/rpc-contracts";
import AskKampusLauncher from "./AskKampusLauncher";
import AdminView from "./dashboard/AdminView";
import DashboardDialog, { type DashboardDialogState } from "./dashboard/DashboardDialog";
import DashboardView from "./dashboard/DashboardView";
import ModeratorView from "./dashboard/ModeratorView";
import PrivacyView from "./dashboard/PrivacyView";
import ReviewView from "./dashboard/ReviewView";
import ThemeToggle from "./ThemeToggle";

const navItems: Array<{ id: AppView; label: string; marker: string }> = [
  { id: "dashboard", label: "Deadline runway", marker: "01" },
  { id: "reviews", label: "Review inbox", marker: "02" },
  { id: "moderator", label: "Moderator queue", marker: "03" },
  { id: "admin", label: "Account monitor", marker: "05" },
  { id: "privacy", label: "Privacy & account", marker: "04" },
];

type DashboardData = {
  generatedAt: string;
  profile: { id?: string; name: string; email: string; role: string; isAdmin?: boolean; accountStatus?: string };
  agendas: Agenda[];
  progress: Record<string, StageStatus>;
  privateDates: Record<string, string>;
  reviews: ReviewItem[];
  proposals: ModeratorProposal[];
  gmail: { connected: boolean; lastSyncAt: string | null; error: string | null };
  availableCategories: string[];
};

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
  const [dialog, setDialog] = useState<DashboardDialogState>(null);
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
    setNotice("Claude is reading messages in your Gmail window…");
    try {
      let totalScanned = 0;
      let totalCandidates = 0;
      let totalFailed = 0;
      let hasMore = true;
      let batches = 0;
      while (hasMore && batches < 50) {
        const response = await fetch("/api/gmail/sync", { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Sync failed");
        applySyncDelta({
          privateAgendas: result.privateAgendas ?? [],
          reviews: result.reviews ?? [],
          lastSyncAt: result.lastSyncAt,
        });
        totalScanned += Number(result.scanned ?? 0);
        totalCandidates += Number(result.candidates ?? 0);
        totalFailed += Number(result.failed ?? 0);
        hasMore = result.hasMore === true;
        batches += 1;
        if (hasMore) setNotice(`Claude has read ${totalScanned} messages. Continuing…`);
      }
      if (hasMore) throw new Error("Claude paused after 500 messages. Refresh again to continue.");
      const retryNote = totalFailed > 0 ? ` ${totalFailed} messages will be retried.` : "";
      setNotice(`Inbox checked: ${totalScanned} messages scanned, ${totalCandidates} deadlines added.${retryNote}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function resolveReview(id: string, action: "approve" | "correct" | "dismiss") {
    const response = await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error ?? "That review decision could not be saved.");
    if (result.agenda) insertAgenda(makeManualAgenda({ ...result.agenda, scope: "private" }));
    setReviews((current) => current.filter((item) => item.id !== id));
    setNotice(action === "approve" ? "Deadline added to your dashboard." : action === "correct" ? "Correction noted." : "Review dismissed.");
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

  async function clearPrivateAgendas() {
    setPendingAction("clear-private");
    setNotice("Deleting private tasks…");
    try {
      const response = await fetch("/api/agendas", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Private tasks could not be deleted.");
      const privateStageIds = new Set(agendas.filter((agenda) => agenda.scope === "private").flatMap((agenda) => agenda.stages.map((stage) => stage.id)));
      setAgendas((current) => current.filter((agenda) => agenda.scope !== "private"));
      setExpanded((current) => current.filter((id) => agendas.some((agenda) => agenda.id === id && agenda.scope === "shared")));
      setStageStates((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !privateStageIds.has(id))));
      setPrivateDates((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !privateStageIds.has(id))));
      setDialog(null);
      const count = Number(result.deletedCount ?? 0);
      setNotice(`${count} private ${count === 1 ? "task" : "tasks"} deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Private tasks could not be deleted.");
    } finally {
      setPendingAction(null);
    }
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
          {navItems.filter((item) => (item.id !== "moderator" || initialData.profile.role === "moderator") && (item.id !== "admin" || initialData.profile.isAdmin)).map((item) => (
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
            {navItems.filter((item) => (item.id !== "moderator" || initialData.profile.role === "moderator") && (item.id !== "admin" || initialData.profile.isAdmin)).map((item) => (
              <option value={item.id} key={item.id}>{item.label}</option>
            ))}
          </select>
        </header>

        <div className="workspace-theme-toggle"><ThemeToggle /></div>

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
            openClearPrivateDialog={() => setDialog({ kind: "clear-private", count: agendas.filter((agenda) => agenda.scope === "private").length })}
            totalPrivateCount={agendas.filter((agenda) => agenda.scope === "private").length}
          />
        )}

        {view === "reviews" && (
          <ReviewView reviews={reviews} resolveReview={resolveReview} />
        )}

        {view === "moderator" && (
          <ModeratorView proposals={proposals} resolveProposal={resolveProposal} createSharedAgenda={createSharedAgenda} />
        )}

        {view === "admin" && initialData.profile.isAdmin && (
          <AdminView currentUserId={initialData.profile.id ?? ""} setNotice={setNotice} />
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
          onClearPrivate={clearPrivateAgendas}
        />
        <AskKampusLauncher />
      </main>
    </div>
  );
}
