"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/ui/clipboard";

interface PublishToolsProps {
  blockId: string;
}

export function PublishTools({ blockId }: PublishToolsProps) {
  const [weeklyStatus, setWeeklyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [embedStatus, setEmbedStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [apiStatus, setApiStatus] = useState<"idle" | "copied" | "failed">("idle");

  const weeklyPath = `/b/${blockId}?lens=7d&mode=weekly`;
  const embedPath = `/embed/${blockId}`;
  const apiPath = `/api/widget/${blockId}`;

  async function copyWeeklyLink() {
    const copied = await copyTextToClipboard(`${window.location.origin}${weeklyPath}`);
    setWeeklyStatus(copied ? "copied" : "failed");
    setTimeout(() => setWeeklyStatus("idle"), 1800);
  }

  async function copyEmbedCode() {
    const src = `${window.location.origin}${embedPath}`;
    const code = `<iframe src="${src}" title="NYC Block Brief widget" width="360" height="230" style="border:0;max-width:100%;" loading="lazy"></iframe>`;
    const copied = await copyTextToClipboard(code);
    setEmbedStatus(copied ? "copied" : "failed");
    setTimeout(() => setEmbedStatus("idle"), 1800);
  }

  async function copyApiLink() {
    const copied = await copyTextToClipboard(`${window.location.origin}${apiPath}`);
    setApiStatus(copied ? "copied" : "failed");
    setTimeout(() => setApiStatus("idle"), 1800);
  }

  return (
    <details className="publish-tools">
      <summary>Publish</summary>
      <div className="publish-tools-menu">
        <button type="button" onClick={copyWeeklyLink}>
          {weeklyStatus === "copied"
            ? "Weekly Link Copied"
            : weeklyStatus === "failed"
              ? "Could not copy weekly link"
              : "Copy weekly digest link"}
        </button>
        <button type="button" onClick={copyEmbedCode}>
          {embedStatus === "copied"
            ? "Embed Code Copied"
            : embedStatus === "failed"
              ? "Could not copy embed code"
              : "Copy embed code"}
        </button>
        <button type="button" onClick={copyApiLink}>
          {apiStatus === "copied"
            ? "API Link Copied"
            : apiStatus === "failed"
              ? "Could not copy API link"
              : "Copy widget API link"}
        </button>
        <a href={embedPath} target="_blank" rel="noreferrer">
          Preview widget
        </a>
      </div>
    </details>
  );
}
