"use client";

import type { ReviewItem } from "../dashboard-data";
import { reviewActionLabels } from "@/lib/dashboard/presentation";
import EmptyState from "./EmptyState";

export default function ReviewView({ reviews, resolveReview }: {
  reviews: ReviewItem[];
  resolveReview: (id: string, action: string) => void;
}) {
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">Private to you</p><h1>Review inbox</h1><p className="lede">Nothing enters your runway until you decide.</p></div>
        <span className="count-display">{reviews.length} open</span>
      </header>
      <div className="privacy-banner"><span aria-hidden="true">◎</span><p>These items were isolated because they may contain sensitive, conflicting, or uncertain information. Raw attachments are not stored.</p></div>
      <div className="review-list">
        {reviews.length === 0 && <EmptyState title="Inbox cleared" copy="Every uncertain item has a decision." />}
        {reviews.map((item) => (
          <article className="review-card" key={item.id}>
            <div className="review-meta"><span className="status-chip warning">{item.kind}</span><small>{item.received}</small></div>
            <h2>{item.title}</h2><p>{item.reason}</p><div className="proposed-date">{item.proposedDate}</div>
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
