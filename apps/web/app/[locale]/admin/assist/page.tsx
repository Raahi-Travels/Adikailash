import { AssistConsole } from "@/components/assist-console";

/**
 * The assistant, for the three people who run this.
 *
 * Doc 04 rates "AI summaries and suggested replies" P1 and qualifies it
 * "human-reviewed and grounded" — so this drafts, and a person sends. There is no
 * path from here to a traveller that does not go through somebody reading it.
 *
 * Inherits `noindex` and the staff-session guard from the admin layout.
 */

export default function AssistPage() {
  return (
    <>
      <h1 className="text-2xl font-medium">Assistant</h1>
      <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-inverse/65">
        Paste a traveller&rsquo;s question. It answers only from our own published
        guides, journeys and verified route records, and refuses outright on anything
        medical, commercial or promissory. Nothing here reaches a traveller until you
        send it.
      </p>
      <AssistConsole />
    </>
  );
}
