"use client";

import { useEffect, useRef } from "react";
import type { Agenda } from "../dashboard-data";

export type DashboardDialogState =
  | { kind: "category"; agenda?: Agenda }
  | { kind: "delete"; agenda: Agenda }
  | { kind: "clear-private"; count: number }
  | { kind: "gmail" }
  | null;

export default function DashboardDialog({
  dialog,
  pendingAction,
  onClose,
  onCreateCategory,
  onDelete,
  onClearPrivate,
}: {
  dialog: DashboardDialogState;
  pendingAction: string | null;
  onClose: () => void;
  onCreateCategory: (category: string, agenda?: Agenda) => Promise<void>;
  onDelete: (agenda: Agenda) => Promise<void>;
  onClearPrivate: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);
  const isBusy = pendingAction === "category-create" || pendingAction === "clear-private" || (dialog?.kind === "delete" && pendingAction === `delete:${dialog.agenda.id}`);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = isBusy;
  }, [isBusy, onClose]);

  useEffect(() => {
    if (!dialog) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => (dialog.kind === "category" ? inputRef.current : closeRef.current)?.focus(), 0);
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleDialogKey);
      previousFocusRef.current?.focus();
    };
  }, [dialog]);

  if (!dialog) return null;

  if (dialog.kind === "gmail") {
    return (
      <div className="dialog-backdrop">
        <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="gmail-dialog-title">
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
        <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
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

  if (dialog.kind === "clear-private") {
    const noun = dialog.count === 1 ? "task" : "tasks";
    return (
      <div className="dialog-backdrop">
        <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-private-dialog-title">
          <p className="eyebrow">Private task cleanup</p>
          <h2 id="clear-private-dialog-title">Delete {dialog.count} private {noun}?</h2>
          <p>Shared batch deadlines, categories, progress, review items, and your Gmail connection stay untouched.</p>
          <div className="dialog-actions">
            <button ref={closeRef} className="button secondary" type="button" onClick={onClose} disabled={isBusy}>Cancel</button>
            <button className="button danger" type="button" onClick={() => void onClearPrivate()} disabled={isBusy}>{isBusy ? "Deleting…" : "Delete private tasks"}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop">
      <section ref={dialogRef} className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title">
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
