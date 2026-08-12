"use client";

import { useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function stop() {
    setState("sending");
    try {
      const res = await fetch(
        `${BASE}/status-alerts/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.detail ?? "That link is not valid.");
        setState("error");
        return;
      }
      setMessage(data.message);
      setState("done");
    } catch {
      setMessage("We could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="mt-8 rounded-lg bg-white/[0.04] px-5 py-5 ring-1 ring-white/10">
        <p className="text-[15px] leading-relaxed text-ink-inverse/80">{message}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-inverse/55">
          The route status stays public either way — you can always read it on the
          status page without hearing from us.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={stop}
        disabled={state === "sending"}
        className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-midnight transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Stopping…" : "Stop sending me alerts"}
      </button>
      {state === "error" && message && (
        <p role="alert" className="mt-4 text-sm text-status-suspended">
          {message}
        </p>
      )}
    </div>
  );
}
