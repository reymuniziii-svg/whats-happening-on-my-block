"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/ui/clipboard";

interface PublishToolsProps {
  blockId: string;
}

export function PublishTools({ blockId }: PublishToolsProps) {
  const [embedStatus, setEmbedStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [apiStatus, setApiStatus] = useState<"idle" | "copied" | "failed">("idle");

  const embedPath = `/embed/${blockId}`;
  const apiPath = `/api/v2/widget/${blockId}`;

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
