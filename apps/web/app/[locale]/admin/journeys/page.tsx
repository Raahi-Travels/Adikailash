import { adminGet } from "@/lib/admin-api";
import type { JourneySummary } from "@/lib/api";

/**
 * Journey catalogue, drafts included.
 *
 * The public list hides drafts; this one shows them, because the whole point of the
 * admin is to see what is not ready. The "cannot publish" column names the missing
 * approved fact rather than just refusing.
 */
export default async function AdminJourneysPage() {
  const journeys = await adminGet<JourneySummary[]>("/admin/journeys");

  if (journeys === null) {
    return (
      <>
        <h1 className="text-2xl font-medium">Journeys</h1>
        <p className="mt-6 rounded-lg bg-status-suspended/15 px-5 py-4 text-[15px] ring-1 ring-status-suspended/30">
          Could not load journeys. Either the API is down, or your roles do not include
          content editing.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-medium">Journeys</h1>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-inverse/65">
        A journey cannot be published until it has an essence and a duration. That rule
        is enforced by the database, not only here.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-white/15 text-sm text-ink-inverse/55">
              <th scope="col" className="py-2.5 pr-4 font-medium">Journey</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Family</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Nights</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Highest point</th>
              <th scope="col" className="py-2.5 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {journeys.map((j) => {
              const missing: string[] = [];
              if (!j.essence) missing.push("essence");
              if (!j.duration_nights) missing.push("duration");

              return (
                <tr key={j.id} className="border-b border-white/10">
                  <td className="py-3.5 pr-4">{j.name}</td>
                  <td className="py-3.5 pr-4 text-ink-inverse/65">
                    {j.family.replace(/_/g, " ")}
                  </td>
                  <td className={`py-3.5 pr-4 ${j.duration_nights ? "" : "text-ink-inverse/40"}`}>
                    {j.duration_nights ?? "not set"}
                  </td>
                  <td
                    className={`py-3.5 pr-4 ${j.highest_altitude_m ? "" : "text-ink-inverse/40"}`}
                  >
                    {j.highest_altitude_m ? `${j.highest_altitude_m} m` : "not set"}
                  </td>
                  <td className="py-3.5">
                    {j.is_published ? (
                      <span className="text-status-open">Published</span>
                    ) : missing.length > 0 ? (
                      <span className="text-ink-inverse/55">
                        Draft, needs {missing.join(" and ")}
                      </span>
                    ) : (
                      <span className="text-ink-inverse/55">Draft, ready to publish</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
