"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/ui/clipboard";

interface ShareButtonProps {
  path: string;
}

export function ShareButton({ path }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLink() {
    const url = `${window.location.origin}${path}`;
    const copied = await copyTextToClipboard(url);
    setStatus(copied ? "copied" : "failed");
    setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <button type="button" onClick={copyLink} className="share-button" aria-live="polite">
      {status === "copied" ? "Copied Link" : status === "failed" ? "Copy Failed" : "Share"}
    </button>
  );
}
