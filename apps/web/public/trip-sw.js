/*
 * Service worker for the trip companion, and for nothing else.
 *
 * Why this exists: the companion page is read in the Vyas valley, where there is no
 * mobile network for two days at a stretch. Without a service worker the browser
 * cannot load the document at all — the page white-screens, and the one screen a
 * traveller needs at 4,000m is the one screen that does not work. Caching the payload
 * in localStorage does not help, because nothing gets far enough to read it.
 *
 * **Scoped deliberately narrowly.** A service worker that caches broadly is how a
 * site starts serving a stale homepage to everyone for a week, with no way to tell
 * them to clear it. So:
 *
 *   - Only URLs matching /trip and the companion API are ever cached.
 *   - Everything else falls straight through to the network, untouched.
 *   - Network-first: a fresh response always wins, and the cache is a fallback for
 *     when the network genuinely is not there.
 *   - One cache name with a version in it; old versions are deleted on activate.
 *
 * The page stamps every response with `generated_at` and shows how old it is, so a
 * cached page announces itself as cached rather than quietly looking live.
 */

const CACHE = "trip-companion-v1";

const CACHEABLE = (url) =>
  /\/trip(\?|$)/.test(url.pathname + url.search) ||
  url.pathname.endsWith("/traveller/companion");

self.addEventListener("install", (event) => {
  // Take over immediately. A traveller who opens this in Dharchula with one bar
  // should be covered by the time they are above Gunji, not on the visit after.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Anything that is not the companion is none of this worker's business.
  if (event.request.method !== "GET" || !CACHEABLE(url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache a real success. Caching a 500 or an opaque redirect would pin
        // the failure in place for as long as the traveller is offline.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) =>
            cached ||
            new Response(
              JSON.stringify({ offline: true }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            ),
        ),
      ),
  );
});
