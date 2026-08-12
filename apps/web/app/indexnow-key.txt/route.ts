import { notFound } from "next/navigation";

/**
 * The IndexNow key file.
 *
 * IndexNow verifies ownership by fetching a file containing exactly the key. By
 * default it looks for `<host>/<key>.txt`, but the protocol also accepts an explicit
 * `keyLocation` in the submission, which is what the API sends. That lets the key
 * live in the environment rather than in a filename committed to the repository.
 *
 * A key in git is a key anyone can use to submit URLs on our behalf. It is not
 * secret in the way a password is — it is fetched over plain HTTP by design — but
 * there is no reason to put it in source history either.
 *
 * 404s when unconfigured, so the absence of a key looks like the absence of a file.
 */

export const revalidate = 3600;

export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) notFound();

  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
