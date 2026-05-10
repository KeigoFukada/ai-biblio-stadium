import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import express from "express";

// tRPC ハンドラー（Vercel サーバーレス関数）
const handler = createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}),
});

const app = express();
app.use(express.json());
app.use("/api/trpc", handler);

export default app;
