"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const AskKampusDrawer = dynamic(() => import("./AskKampusDrawer"), { ssr: false });

export default function AskKampusLauncher({ gmailConnected }: { gmailConnected: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button" className="ask-launcher" onClick={() => { setLoaded(true); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open}>
        <span aria-hidden="true">✦</span> Ask Kampus
      </button>
      {loaded && <AskKampusDrawer open={open} gmailConnected={gmailConnected} onClose={() => setOpen(false)} returnFocusRef={triggerRef} />}
    </>
  );
}
