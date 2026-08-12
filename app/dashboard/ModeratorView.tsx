"use client";

import type { FormEvent } from "react";
import type { ModeratorProposal } from "../dashboard-data";
import { moderatorActionLabels } from "@/lib/dashboard/presentation";
import type { ModeratorDecision } from "@/lib/reliability/rpc-contracts";
import EmptyState from "./EmptyState";
import ManualDeadlineForm from "./ManualDeadlineForm";

export default function ModeratorView({ proposals, resolveProposal, createSharedAgenda }: {
  proposals: ModeratorProposal[];
  resolveProposal: (id: string, action: ModeratorDecision) => void;
  createSharedAgenda: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="page-wrap wide-page">
      <header className="page-heading">
        <div><p className="eyebrow">Moderator only · shared base</p><h1>Moderator queue</h1><p className="lede">Approve the common fact once. Keep student-specific context private.</p></div>
        <div className="health-mini"><span className="health-dot" /> All systems nominal</div>
      </header>
      <section className="health-grid" aria-label="Pilot health">
        <div><span>Open proposals</span><strong>{proposals.length}</strong></div><div><span>Queue access</span><strong><small>Role-gated</small></strong></div><div><span>Gmail permission</span><strong><small>Read only</small></strong></div><div><span>Raw mail storage</span><strong><small>None</small></strong></div>
      </section>
      <section className="manual-deadline-card moderator-add" aria-label="Publish a verified shared deadline">
        <div><p className="eyebrow">Verified shared base</p><h2>Publish a shared deadline</h2><p>Add only an announcement you have personally verified for the batch.</p></div>
        <ManualDeadlineForm submitLabel="Publish shared deadline" onSubmit={createSharedAgenda} />
      </section>
      <div className="proposal-list">
        {proposals.length === 0 && <EmptyState title="Queue cleared" copy="No shared announcement is waiting for approval." />}
        {proposals.map((proposal) => (
          <article className="proposal-card" key={proposal.id}>
            <div className="proposal-top"><div><span className="status-chip neutral">{proposal.action}</span><h2>{proposal.title}</h2><p>{proposal.match}</p></div><div className="confidence-ring">{Math.round(proposal.confidence * 100)}<small>%</small></div></div>
            <div className="diff-grid"><div><span>Before</span><p>{proposal.before}</p></div><div className="diff-arrow" aria-hidden="true">→</div><div><span>Proposed</span><p>{proposal.after}</p></div></div>
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
