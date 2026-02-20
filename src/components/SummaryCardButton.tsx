"use client";

import { useState } from "react";
import { summaryMetrics } from "@/lib/brief/summary-metrics";
import type { BriefResponse } from "@/types/brief";

interface SummaryCardButtonProps {
  brief: BriefResponse;
  path: string;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let linesUsed = 0;
  let drawY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const measured = ctx.measureText(testLine).width;
    if (measured > maxWidth && line) {
      ctx.fillText(line, x, drawY);
      linesUsed += 1;
      drawY += lineHeight;
      line = word;
      if (linesUsed >= maxLines - 1) {
        break;
      }
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, drawY);
    drawY += lineHeight;
  }

  return drawY;
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
): void {
  ctx.fillStyle = "#fff9ef";
  ctx.strokeStyle = "#dbcfb7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#51647a";
  ctx.font = "600 20px Manrope, sans-serif";
  ctx.fillText(label, x + 18, y + 34);

  ctx.fillStyle = "#102231";
  ctx.font = "700 30px Manrope, sans-serif";
  drawWrappedText(ctx, value, x + 18, y + 74, w - 32, 34, 2);
}

export function SummaryCardButton({ brief, path }: SummaryCardButtonProps) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  function exportSummaryCard() {
    setState("working");

    const metrics = summaryMetrics(brief);

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setState("idle");
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#f9edd9");
    gradient.addColorStop(0.5, "#f7f2e6");
    gradient.addColorStop(1, "#e0efe7");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    ctx.fillStyle = "#1f3b4e";
    ctx.font = "700 48px Manrope, sans-serif";
    ctx.fillText("What's Happening on My Block?", 52, 84);

    ctx.fillStyle = "#51647a";
    ctx.font = "600 20px Manrope, sans-serif";
    drawWrappedText(ctx, brief.input.normalized_address, 52, 122, 880, 30, 2);

    ctx.fillStyle = "#0f5c4d";
    ctx.font = "600 18px 'IBM Plex Mono', monospace";
    ctx.fillText(`Updated ${new Date(brief.updated_at_utc).toLocaleString("en-US", { timeZone: "UTC" })} UTC`, 52, 188);

    const cardY = 232;
    const cardW = 268;
    const cardH = 158;
    const gap = 20;

    drawMetricCard(
      ctx,
      52,
      cardY,
      cardW,
      cardH,
      "Right now",
      metrics.activeDisruptions === 0 ? "Calm block conditions" : `${metrics.activeDisruptions} active disruptions`,
    );
    drawMetricCard(
      ctx,
      52 + (cardW + gap),
      cardY,
      cardW,
      cardH,
      "Safety (90d)",
      `${metrics.crashes90d} crashes, ${metrics.injuries90d} injuries`,
    );
    drawMetricCard(ctx, 52 + 2 * (cardW + gap), cardY, cardW, cardH, "311 pulse", `${metrics.requests30d} requests`);
    drawMetricCard(ctx, 52 + 3 * (cardW + gap), cardY, cardW, cardH, "Events (30d)", `${metrics.upcomingEvents} upcoming events`);

    ctx.fillStyle = "#385067";
    ctx.font = "600 18px Manrope, sans-serif";
    ctx.fillText("Data: NYC Open Data via SODA. Full methodology and sources in-app.", 52, 452);

    ctx.fillStyle = "#0f5c4d";
    ctx.font = "700 18px 'IBM Plex Mono', monospace";
    ctx.fillText(`${window.location.origin}${path}`, 52, 492);

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = "block-brief-summary.png";
    downloadLink.click();

    setState("done");
    setTimeout(() => setState("idle"), 1800);
  }

  return (
    <button type="button" onClick={exportSummaryCard} className="summary-export-button" aria-live="polite">
      {state === "working" ? "Preparing Card..." : state === "done" ? "Card Downloaded" : "Shareable Card"}
    </button>
  );
}
