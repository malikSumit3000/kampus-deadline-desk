"use client";

import { useEffect, useRef, useState } from "react";

export default function AskKampusLauncher() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" className="ask-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <span aria-hidden="true">✦</span> Ask Kampus
      </button>
      {open && <div className="dialog-backdrop">
        <section className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="ask-coming-soon-title">
          <p className="eyebrow">Coming soon</p>
          <h2 id="ask-coming-soon-title">Ask Kampus is coming soon</h2>
          <p>Live Gmail questions and task summaries are being prepared for a future release.</p>
          <div className="dialog-actions"><button ref={closeRef} className="button secondary" type="button" onClick={close}>Got it</button></div>
        </section>
      </div>}
    </>
  );
}
