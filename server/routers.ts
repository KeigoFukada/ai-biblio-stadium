import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { presentationRouter } from "./routers/presentation.js";
import { booksRouter } from "./routers/books.js";
import { dreamMatchRouter } from "./routers/dreamMatch.js";
import { battlerRouter } from "./routers/battler.js";

const t = initTRPC.context<object>().create({ transformer: superjson });

export const appRouter = t.router({
  presentation: presentationRouter,
  books: booksRouter,
  dreamMatch: dreamMatchRouter,
  battler: battlerRouter,
});

export type AppRouter = typeof appRouter;
