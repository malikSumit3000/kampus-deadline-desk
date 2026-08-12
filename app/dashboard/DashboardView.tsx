"use client";

import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { categoryTabs, type Agenda, type Category, type StageStatus } from "../dashboard-data";
import { agendaAttribution, stageProgress } from "@/lib/dashboard/presentation";
import ManualDeadlineForm from "./ManualDeadlineForm";

const statuses: StageStatus[] = ["to-do", "in progress", "submitted"];

export type DashboardViewProps = {
  category: Category; setCategory: (category: Category) => void; visibleAgendas: Agenda[]; expanded: string[]; toggleAgenda: (id: string) => void;
  stageStates: Record<string, StageStatus>; updateStageStatus: (stageId: string, status: StageStatus) => void; privateDates: Record<string, string>; updatePrivateDate: (stageId: string, deadline: string) => void;
  lastSync: string; syncing: boolean; refreshInbox: () => void; openReviews: () => void; reviewCount: number; gmailConnected: boolean; gmailError: string | null;
  createManualDeadline: (event: FormEvent<HTMLFormElement>) => void; availableCategories: string[]; updatePersonalCategory: (agenda: Agenda, category: string) => void;
  openCategoryDialog: (agenda?: Agenda) => void; openDeleteDialog: (agenda: Agenda) => void; canDeleteShared: boolean; nowMs: number; pendingAction: string | null;
  showManualEntry: boolean; setShowManualEntry: (show: boolean) => void; openGmailDetails: () => void;
};

function dateParts(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(date));
}

function dateTile(date: string) {
  const parts = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).formatToParts(new Date(date));
  return { day: parts.find((part) => part.type === "day")?.value ?? "", month: parts.find((part) => part.type === "month")?.value ?? "" };
}

function categoryTone(category: string) {
  const known: Record<string, string> = { Academics: "academics", Committees: "committees", Placements: "placements", Personal: "personal" };
  return known[category] ?? "custom";
}

export default function DashboardView(props: DashboardViewProps) {
  const { category, setCategory, visibleAgendas, expanded, toggleAgenda, stageStates, updateStageStatus, privateDates, updatePrivateDate, syncing, refreshInbox, openReviews, reviewCount, gmailConnected, gmailError, createManualDeadline, availableCategories, updatePersonalCategory, openCategoryDialog, openDeleteDialog, canDeleteShared, nowMs, pendingAction, showManualEntry, setShowManualEntry, openGmailDetails } = props;
  const tabs = categoryTabs(availableCategories);
  const upNext = visibleAgendas[0] ?? null;
  const dueIn24h = visibleAgendas.filter((agenda) => { const remaining = new Date(agenda.deadline).getTime() - nowMs; return remaining >= 0 && remaining <= 86_400_000; }).length;
  const dueThisWeek = visibleAgendas.filter((agenda) => { const remaining = new Date(agenda.deadline).getTime() - nowMs; return remaining > 86_400_000 && remaining <= 604_800_000; }).length;
  const privateCount = visibleAgendas.filter((agenda) => agenda.scope === "private").length;
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date(nowMs));

  function taskStatus(agenda: Agenda) {
    const taskStages = agenda.stages.map((stage) => stageStates[stage.id] ?? stage.status);
    const status: StageStatus = taskStages.every((item) => item === "submitted") ? "submitted" : taskStages.some((item) => item === "in progress" || item === "submitted") ? "in progress" : "to-do";
    return stageProgress(status);
  }

  return <div className="page-wrap workspace-page">
    <header className="workspace-header">
      <div><p className="eyebrow">My workspace</p><h1>Make the week manageable.</h1><p className="workspace-date">{today}</p></div>
      <div className="header-utilities">
        <span className={`gmail-mini ${gmailError ? "needs-attention" : ""}`}>{gmailConnected ? "Gmail connected · Read only" : "Gmail not connected"}</span>
        <button className="button gmail-action" onClick={refreshInbox} disabled={syncing}>{syncing ? "Checking…" : gmailConnected ? "Refresh inbox" : "Connect Gmail"}</button>
        {gmailConnected && <button className="info-button" onClick={openGmailDetails} aria-label="How Gmail access works">i</button>}
      </div>
    </header>

    {upNext && <section className="up-next" aria-label="Your next deadline">
      <div className={`up-next-date urgency-${upNext.urgency}`}><small>{dateTile(upNext.deadline).month}</small><strong>{dateTile(upNext.deadline).day}</strong></div>
      <div className="up-next-copy"><p className="eyebrow">Up next</p><h2>{upNext.title}</h2><div><span className={`category-pill ${categoryTone(upNext.category)}`}>{upNext.category}</span><span className={`countdown-chip urgency-${upNext.urgency}`}>{upNext.countdown} left</span></div></div>
      <button className="button open-task" onClick={() => toggleAgenda(upNext.id)} aria-expanded={expanded.includes(upNext.id)}>Open task</button>
    </section>}

    <section className="runway-summary" aria-label="Deadline summary"><div className="summary-urgent"><strong>{dueIn24h}</strong><span>urgent</span></div><div className="summary-week"><strong>{dueThisWeek}</strong><span>this week</span></div><div className="summary-personal"><strong>{privateCount}</strong><span>personal</span></div></section>

    <section className="agenda-section">
      <div className="section-label-row"><div><h2>Upcoming</h2></div><button className="review-pill" onClick={openReviews}><span>{reviewCount}</span> review items</button></div>
      <div className="tabs" role="tablist" aria-label="Deadline category">
        {tabs.map((item, index) => <button role="tab" id={`deadline-category-tab-${index}`} aria-controls="deadline-category-panel" aria-selected={category === item} tabIndex={category === item ? 0 : -1} className={category === item ? "active" : ""} onClick={() => setCategory(item)} onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => { const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]; if (!keys.includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setCategory(tabs[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus(); }} key={item}>{item}</button>)}
        <button type="button" className="category-add-tab" onClick={() => openCategoryDialog()}>+ Category</button>
      </div>
      <div className="agenda-table" id="deadline-category-panel" role="tabpanel" aria-labelledby={`deadline-category-tab-${Math.max(0, tabs.indexOf(category))}`}>
        <div className="agenda-table-head" aria-hidden="true"><span>Task</span><span>Deadline</span><span>Action / context</span><span>Category</span><span>Source</span><span>Status</span><span /></div>
        {visibleAgendas.map((agenda) => {
          const isOpen = expanded.includes(agenda.id); const status = taskStatus(agenda); const tile = dateTile(agenda.deadline);
          return <article className={`agenda-card scope-${agenda.scope}`} key={agenda.id}>
            <button className="agenda-summary" onClick={() => toggleAgenda(agenda.id)} aria-expanded={isOpen}>
              <span className={`urgency urgency-${agenda.urgency}`}><small>{tile.month}</small><strong>{tile.day}</strong></span>
              <span className="agenda-main"><strong className="agenda-title">{agenda.title}</strong><small className="mobile-deadline">{dateParts(agenda.deadline)}</small></span>
              <span className="agenda-deadline">{dateParts(agenda.deadline)}</span><span className="agenda-context">{agenda.detail || "View task details"}</span>
              <span className={`category-pill ${categoryTone(agenda.category)}`}>{agenda.category}</span><span className="agenda-source">{agenda.source}</span>
              <span className={`agenda-status ${status.tone}`}><i aria-hidden="true" />{status.label}</span><span className="expand-mark" aria-hidden="true">{isOpen ? "−" : "›"}</span>
            </button>
            {isOpen && <div className="agenda-details"><div className="source-row"><span>{agenda.source}</span><span>{agendaAttribution(agenda)}</span></div>{agenda.stages.map((stage, index) => <div className="stage-row" key={stage.id}><div className="stage-index">{String(index + 1).padStart(2, "0")}</div><div className="stage-copy"><strong>{stage.name}</strong><span>{stage.note}</span>{privateDates[stage.id] && <span className="date-conflict">Private override: {privateDates[stage.id]} · Canonical date unchanged</span>}</div><div className="stage-controls"><label><span className="sr-only">Progress for {stage.name}</span><select value={stageStates[stage.id]} onChange={(event) => updateStageStatus(stage.id, event.target.value as StageStatus)} disabled={pendingAction === `progress:${stage.id}`}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><label className="date-field"><span>Private date</span><input type="date" value={privateDates[stage.id] ?? ""} onChange={(event) => updatePrivateDate(stage.id, event.target.value)} disabled={pendingAction === `date:${stage.id}`} /></label></div></div>)}<details className="task-manage"><summary>Manage task</summary><div className="task-manage-controls"><label className="category-control"><span>Personal category</span><select value={agenda.category} onChange={(event) => updatePersonalCategory(agenda, event.target.value)} disabled={pendingAction === `category:${agenda.id}`}>{availableCategories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="text-link category-add" onClick={() => openCategoryDialog(agenda)}>+ Custom category</button>{(agenda.scope === "private" || canDeleteShared) && <button type="button" className="delete-task" onClick={() => openDeleteDialog(agenda)}>Delete task</button>}</div></details></div>}
          </article>;
        })}
      </div>
    </section>
    <section className="manual-deadline-card manual-deadline-panel" aria-label="Add a private deadline"><button type="button" className="manual-deadline-toggle" aria-label="Add a private deadline" onClick={() => setShowManualEntry(!showManualEntry)} aria-expanded={showManualEntry}><span><span className="eyebrow">Personal planning</span><strong>+ Add private deadline</strong><small>Visible only to you.</small></span><span aria-hidden="true">{showManualEntry ? "−" : "+"}</span></button>{showManualEntry && <ManualDeadlineForm submitLabel={pendingAction === "manual-deadline" ? "Adding…" : "Add private deadline"} onSubmit={createManualDeadline} pending={pendingAction === "manual-deadline"} />}</section>
  </div>;
}
