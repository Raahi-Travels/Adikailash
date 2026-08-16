"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchChecklist,
  uploadDocument,
  type Locale,
  type TravellerChecklist,
  type TravellerDocument,
} from "@/lib/api";

/**
 * Traveller document checklist and upload.
 *
 * Doc 05 governs the states shown here. The one that shapes the whole component:
 * "The portal does not label a document as approved merely because it was uploaded."
 * So uploaded and accepted are visually distinct, and only a reviewer's decision
 * turns an item green.
 */

type Row = TravellerDocument & { busy?: boolean; error?: string | null };

function StateChip({ doc }: { doc: TravellerDocument }) {
  const [label, tone] =
    doc.state === "accepted"
      ? ["Accepted", "text-status-open ring-status-open/30"]
      : doc.state === "needs_correction"
        ? ["Needs correction", "text-status-limited ring-status-limited/30"]
        : doc.state === "uploaded" || doc.state === "under_review"
          ? ["With our team", "text-tone-body ring-tone-line"]
          : doc.state === "waived"
            ? ["Not required for you", "text-tone-body ring-tone-line"]
            : doc.state === "expired"
              ? ["Expired", "text-status-suspended ring-status-suspended/30"]
              : ["Not sent yet", "text-tone-muted ring-tone-line"];

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-sm ring-1 ${tone}`}>
      {label}
    </span>
  );
}

export function DocumentUpload({
  token,
  locale,
}: {
  token: string;
  locale: Locale;
}) {
  const [data, setData] = useState<TravellerChecklist | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const next = await fetchChecklist(token, locale);
      setData(next);
      setRows(next.documents);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your documents.");
    }
  }, [token, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile(doc: Row, file: File) {
    // Checked here for a fast, readable message. The API and the bucket both
    // enforce it again; this is convenience, not the security boundary.
    if (data && !data.accepted_content_types.includes(file.type)) {
      setRows((r) =>
        r.map((x) =>
          x.id === doc.id
            ? { ...x, error: "Please send a JPG, PNG, HEIC or PDF." }
            : x,
        ),
      );
      return;
    }
    if (data && file.size > data.max_bytes) {
      const mb = Math.round(data.max_bytes / (1024 * 1024));
      setRows((r) =>
        r.map((x) =>
          x.id === doc.id ? { ...x, error: `That file is over ${mb}MB.` } : x,
        ),
      );
      return;
    }

    setRows((r) =>
      r.map((x) => (x.id === doc.id ? { ...x, busy: true, error: null } : x)),
    );
    try {
      await uploadDocument(token, doc.id, file);
      await load();
    } catch (err) {
      setRows((r) =>
        r.map((x) =>
          x.id === doc.id
            ? {
                ...x,
                busy: false,
                error: err instanceof Error ? err.message : "Upload failed.",
              }
            : x,
        ),
      );
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg bg-tone-raised px-6 py-8 ring-1 ring-tone-line">
        <h2 className="text-xl text-tone-strong">This link is not working</h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
          {loadError}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your documents">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-tone-raised px-6 py-8 ring-1 ring-tone-line">
        <h2 className="text-xl text-tone-strong">Nothing to send yet</h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-tone-body">
          Your coordinator has not requested any documents yet. They will let you know
          when the permit paperwork opens for your departure.
        </p>
      </div>
    );
  }

  // Preserve API order within each person, and keep people in first-seen order.
  const grouped = new Map<string | null, Row[]>();
  for (const doc of rows) {
    const key = doc.for_traveller ?? null;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(doc);
    else grouped.set(key, [doc]);
  }
  const groups = [...grouped.entries()];

  return (
    <div>
      <p className="text-[15px] text-tone-body">
        {data.outstanding_count === 0
          ? "Everything we asked for is with us. We will tell you if anything needs changing."
          : `${data.outstanding_count} of ${rows.length} still need something from you.`}
      </p>

      {/*
        Grouped by person. A party of four produces four identical "Government photo
        ID" rows, and an ungrouped list of them is unusable: the group lead cannot
        tell which one still needs their father's passport.
      */}
      {groups.map(([traveller, docs]) => (
        <section key={traveller ?? "party"} className="mt-8">
          {traveller && (
            <h3 className="text-sm uppercase tracking-[0.12em] text-gold">
              {traveller}
              <span className="ml-3 normal-case tracking-normal text-tone-muted">
                {docs.filter((d) => d.awaiting_you).length} of {docs.length} outstanding
              </span>
            </h3>
          )}
      <ul className="mt-4 space-y-5">
        {docs.map((doc) => (
          <li key={doc.id} className="border-t border-tone-line pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[17px] text-tone-strong">
                  {doc.requirement_label}
                  {!doc.is_mandatory && (
                    <span className="ml-2 text-sm text-tone-muted">optional</span>
                  )}
                </h3>
                {doc.requirement_description && (
                  <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-tone-body">
                    {doc.requirement_description}
                  </p>
                )}
              </div>
              <StateChip doc={doc} />
            </div>

            {doc.correction_reason && (
              <p className="mt-3 max-w-[58ch] rounded-md bg-status-limited/15 px-4 py-3 text-sm leading-relaxed text-tone-strong ring-1 ring-status-limited/25">
                <span className="font-medium">Please send this again. </span>
                {doc.correction_reason}
              </p>
            )}

            {doc.is_uploaded && !doc.is_accepted && doc.state !== "needs_correction" && (
              <p className="mt-3 text-sm text-tone-muted">
                {doc.original_filename ? `${doc.original_filename} received. ` : "Received. "}
                A member of our team will check it. Being received is not the same as
                being accepted.
              </p>
            )}

            {doc.error && (
              <p role="alert" className="mt-3 text-sm text-status-suspended">
                {doc.error}
              </p>
            )}

            {doc.state !== "accepted" && doc.state !== "waived" && (
              <div className="mt-4">
                <input
                  ref={(el) => {
                    inputs.current[doc.id] = el;
                  }}
                  id={`file-${doc.id}`}
                  type="file"
                  accept={data.accepted_content_types.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onFile(doc, file);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor={`file-${doc.id}`}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium ring-1 transition-colors ${
                    doc.busy
                      ? "cursor-wait text-tone-muted ring-tone-line"
                      : "text-tone-strong ring-tone-line hover:ring-tone-line"
                  }`}
                >
                  {doc.busy
                    ? "Sending"
                    : doc.is_uploaded
                      ? "Send a different file"
                      : "Choose a file"}
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
        </section>
      ))}

      <p className="mt-10 border-t border-tone-line pt-6 text-sm leading-relaxed text-tone-muted">
        Sending these does not guarantee a permit. Permits are issued by the
        authorities, not by us. We submit your paperwork and tell you the outcome as
        soon as we have it. Files go straight into encrypted storage and are only seen
        by the team member reviewing them.
      </p>
    </div>
  );
}
