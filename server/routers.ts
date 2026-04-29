import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { presentationRouter } from "./routers/presentation";
import { booksRouter } from "./routers/books";
import { dreamMatchRouter } from "./routers/dreamMatch";
import { battlerRouter } from "./routers/battler";

const t = initTRPC.context<object>().create({ transformer: superjson });

export const appRouter = t.router({
  presentation: presentationRouter,
  books: booksRouter,
  dreamMatch: dreamMatchRouter,
  battler: battlerRouter,
});

export type AppRouter = typeof appRouter;
