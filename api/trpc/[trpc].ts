import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Build a proper URL for the fetch request handler
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url}`;

  // Convert Node.js headers to Fetch API Headers
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val != null) {
      headers.set(key, Array.isArray(val) ? val.join(", ") : val);
    }
  }

  // Serialize body (Vercel parses JSON body automatically into req.body)
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
}
