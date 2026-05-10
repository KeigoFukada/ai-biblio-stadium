import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Dynamic import so module-level errors are catchable
  let fetchRequestHandler: typeof import("@trpc/server/adapters/fetch").fetchRequestHandler;
  let appRouter: typeof import("../../server/routers").appRouter;

  try {
    const fetchMod = await import("@trpc/server/adapters/fetch");
    fetchRequestHandler = fetchMod.fetchRequestHandler;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tRPC] failed to import fetch adapter:", msg);
    res.status(500).json({ error: "import failed: fetch adapter", detail: msg });
    return;
  }

  try {
    const routerMod = await import("../../server/routers");
    appRouter = routerMod.appRouter;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tRPC] failed to import appRouter:", msg);
    res.status(500).json({ error: "import failed: appRouter", detail: msg });
    return;
  }

  // Build a proper URL for the fetch request handler
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val != null) {
      headers.set(key, Array.isArray(val) ? val.join(", ") : val);
    }
  }

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  const fetchReq = new Request(url, {
    method: req.method ?? "GET",
    headers,
    body,
  });

  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchReq,
      router: appRouter,
      createContext: () => ({}),
    });

    res.status(response.status);
    for (const [key, val] of response.headers.entries()) {
      res.setHeader(key, val);
    }
    const responseBody = await response.text();
    res.send(responseBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[tRPC] fetchRequestHandler error:", msg, stack);
    res.status(500).json({ error: "handler error", detail: msg, stack });
  }
}
