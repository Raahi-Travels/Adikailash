import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Server-side calls to the staff API.
 *
 * The session cookie is forwarded so FastAPI can look the session up in
 * `yatra.staff_sessions` and resolve roles itself. Authorisation is decided once, in
 * the API, rather than duplicated in the UI where the two copies would drift apart.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export async function currentStaff() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

async function authedFetch(path: string, init?: RequestInit) {
  const cookie = (await headers()).get("cookie") ?? "";
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), cookie, "Content-Type": "application/json" },
    cache: "no-store",
  });
}

export async function adminGet<T>(path: string): Promise<T | null> {
  try {
    const res = await authedFetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function adminPost<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await authedFetch(path, { method: "POST", body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.detail ?? `Request failed (${res.status}).` };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not reach the API.",
    };
  }
}
