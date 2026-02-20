"use client";

import { useState } from "react";

interface PublishToolsProps {
  blockId: string;
}

export function PublishTools({ blockId }: PublishToolsProps) {
  const [weeklyStatus, setWeeklyStatus] = useState<"idle" | "copied">("idle");
  const [embedStatus, setEmbedStatus] = useState<"idle" | "copied">("idle");
  const [apiStatus, setApiStatus] = useState<"idle" | "copied">("idle");

  const weeklyPath = `/b/${blockId}?lens=7d&mode=weekly`;
  const embedPath = `/embed/${blockId}`;
  const apiPath = `/api/widget/${blockId}`;

  async function copyWeeklyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${weeklyPath}`);
    setWeeklyStatus("copied");
    setTimeout(() => setWeeklyStatus("idle"), 1800);
  }

  async function copyEmbedCode() {
    const src = `${window.location.origin}${embedPath}`;
    const code = `<iframe src="${src}" title="NYC Block Brief widget" width="360" height="230" style="border:0;max-width:100%;" loading="lazy"></iframe>`;
    await navigator.clipboard.writeText(code);
    setEmbedStatus("copied");
    setTimeout(() => setEmbedStatus("idle"), 1800);
  }

  async function copyApiLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${apiPath}`);
    setApiStatus("copied");
    setTimeout(() => setApiStatus("idle"), 1800);
  }

  return (
    <details className="publish-tools">
      <summary>Publish</summary>
      <div className="publish-tools-menu">
        <button type="button" onClick={copyWeeklyLink}>
          {weeklyStatus === "copied" ? "Weekly Link Copied" : "Copy weekly digest link"}
        </button>
        <button type="button" onClick={copyEmbedCode}>
          {embedStatus === "copied" ? "Embed Code Copied" : "Copy embed code"}
        </button>
        <button type="button" onClick={copyApiLink}>
          {apiStatus === "copied" ? "API Link Copied" : "Copy widget API link"}
        </button>
        <a href={embedPath} target="_blank" rel="noreferrer">
          Preview widget
        </a>
      </div>
    </details>
  );
}
