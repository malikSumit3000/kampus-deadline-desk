"use client";

import type { FormEvent } from "react";
import { categories } from "../dashboard-data";

export default function ManualDeadlineForm({
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
