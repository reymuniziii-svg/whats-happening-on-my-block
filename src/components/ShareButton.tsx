"use client";

import { useState } from "react";

interface ShareButtonProps {
  path: string;
}

export function ShareButton({ path }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");

  async function copyLink() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setStatus("copied");
    setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <button type="button" onClick={copyLink} className="share-button" aria-live="polite">
      {status === "copied" ? "Copied Link" : "Share"}
    </button>
  );
}
