"use client";

import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { categoryTabs, type Agenda, type Category, type StageStatus } from "../dashboard-data";
import { agendaAttribution } from "@/lib/dashboard/presentation";
import ManualDeadlineForm from "./ManualDeadlineForm";

const statuses: StageStatus[] = ["to-do", "in progress", "submitted"];

export type DashboardViewProps = {
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

export default function DashboardView({
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
  const tabs = categoryTabs(availableCategories);
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
        <div><p className="eyebrow">{today} · Asia/Kolkata</p><h1>Your deadline runway</h1><p className="lede">{visibleAgendas.length} live commitments, ordered around you.</p></div>
        <button className="review-pill" onClick={openReviews}><span>{reviewCount}</span> items need your review <b aria-hidden="true">→</b></button>
      </header>

      <section className="sync-card" aria-label="Gmail connection status">
        <div className="sync-brand"><span>G</span></div>
        <div className="sync-copy">
          <div className="sync-title-row"><h2>{gmailConnected ? "Gmail connected" : "Connect Gmail"}</h2><span className={`status-chip ${gmailConnected ? "connected" : "neutral"}`}>{gmailConnected ? "Read only" : "Optional"}</span></div>
          <p>{gmailConnected ? `Last successful sync ${lastSync} · New mail only since connection` : "Website sign-in does not grant inbox access."}</p>
        </div>
        <div className="sync-side"><p><span className="health-dot" /> {gmailError ? "Connection needs attention" : gmailConnected ? "Connection healthy" : "Not connected"}</p><button className="button secondary" onClick={refreshInbox} disabled={syncing}>{syncing ? "Checking…" : gmailConnected ? "Refresh inbox" : "Connect Gmail"}</button></div>
      </section>

      {gmailConnected && <div className="warning-strip" role="note"><span aria-hidden="true">!</span><p><strong>Pilot connection:</strong> If the Google Cloud app remains in testing mode, Google may require students to reconnect periodically.</p><button onClick={openGmailDetails}>How it works</button></div>}

      <section className="runway-summary" aria-label="Deadline summary">
        <div><strong>{dueIn24h}</strong><span>due in 24 hours</span></div><div><strong>{dueThisWeek}</strong><span>due this week</span></div><div><strong>{privateCount}</strong><span>private items</span></div><div className="runway-line" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <section className="agenda-section">
        <div className="section-label-row"><div><p className="eyebrow">Priority view</p><h2>Upcoming</h2></div><p>Ordered by urgency, then deadline</p></div>
        <div className="tabs" role="tablist" aria-label="Deadline category">
          {tabs.map((item, index) => (
            <button
              role="tab"
              id={`deadline-category-tab-${index}`}
              aria-controls="deadline-category-panel"
              aria-selected={category === item}
              tabIndex={category === item ? 0 : -1}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                setCategory(tabs[nextIndex]);
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
              }}
              key={item}
            >{item}</button>
          ))}
          <button type="button" className="category-add-tab" onClick={() => openCategoryDialog()}>+ Category</button>
        </div>

        <div className="agenda-list" id="deadline-category-panel" role="tabpanel" aria-labelledby={`deadline-category-tab-${Math.max(0, tabs.indexOf(category))}`}>
          {visibleAgendas.map((agenda) => {
            const isOpen = expanded.includes(agenda.id);
            return (
              <article className={`agenda-card scope-${agenda.scope}`} key={agenda.id}>
                <button className="agenda-summary" onClick={() => toggleAgenda(agenda.id)} aria-expanded={isOpen}>
                  <span className={`urgency urgency-${agenda.urgency}`}><strong>{agenda.countdown}</strong><small>{agenda.urgency === "now" ? "left" : "away"}</small></span>
                  <span className="agenda-main"><span className="agenda-kickers"><span>{agenda.category}</span><span className={`scope-badge ${agenda.scope}`}>{agenda.scope}</span></span><strong className="agenda-title">{agenda.title}</strong><small>{agenda.detail}</small></span>
                  <span className="agenda-date"><strong>{agenda.displayDate}</strong><small>{agenda.stages.length} {agenda.stages.length === 1 ? "stage" : "stages"}</small></span>
                  <span className="expand-mark" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="agenda-details">
                    <div className="source-row"><span>{agenda.source}</span><span>{agendaAttribution(agenda)}</span></div>
                    {agenda.stages.map((stage, index) => (
                      <div className="stage-row" key={stage.id}>
                        <div className="stage-index">{String(index + 1).padStart(2, "0")}</div>
                        <div className="stage-copy"><strong>{stage.name}</strong><span>{stage.note}</span>{privateDates[stage.id] && <span className="date-conflict">Private override: {privateDates[stage.id]} · Canonical date unchanged</span>}</div>
                        <div className="stage-controls">
                          <label><span className="sr-only">Progress for {stage.name}</span><select value={stageStates[stage.id]} onChange={(event) => updateStageStatus(stage.id, event.target.value as StageStatus)} disabled={pendingAction === `progress:${stage.id}`}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                          <label className="date-field"><span>Private date</span><input type="date" value={privateDates[stage.id] ?? ""} onChange={(event) => updatePrivateDate(stage.id, event.target.value)} disabled={pendingAction === `date:${stage.id}`} /></label>
                        </div>
                      </div>
                    ))}
                    <details className="task-manage">
                      <summary>Manage task</summary>
                      <div className="task-manage-controls">
                        <label className="category-control"><span>Personal category</span><select value={agenda.category} onChange={(event) => updatePersonalCategory(agenda, event.target.value)} disabled={pendingAction === `category:${agenda.id}`}>{availableCategories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></label>
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
        <button type="button" className="manual-deadline-toggle" onClick={() => setShowManualEntry(!showManualEntry)} aria-expanded={showManualEntry}>
          <span><span className="eyebrow">Personal planning</span><strong>Add a private deadline</strong><small>Visible only to you.</small></span><span aria-hidden="true">{showManualEntry ? "−" : "+"}</span>
        </button>
        {showManualEntry && <ManualDeadlineForm submitLabel={pendingAction === "manual-deadline" ? "Adding…" : "Add private deadline"} onSubmit={createManualDeadline} pending={pendingAction === "manual-deadline"} />}
      </section>
    </div>
  );
}
