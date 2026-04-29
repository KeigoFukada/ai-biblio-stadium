import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import axios from "axios";
import type { BookInfo } from "@shared/types";

const t = initTRPC.context<object>().create({ transformer: superjson });

export const booksRouter = t.router({
  search: t.procedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }): Promise<BookInfo[]> => {
      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
      const params: Record<string, string> = {
        q: input.query,
        maxResults: "8",
        langRestrict: "ja",
        printType: "books",
      };
      if (apiKey) params.key = apiKey;

      let items: any[] = [];
      try {
        const res = await axios.get("https://www.googleapis.com/books/v1/volumes", {
          params,
          timeout: 10_000,
        });
        items = res.data.items ?? [];
      } catch {
        // API 失敗時は空配列を返す（クライアント側で「見つからない」表示）
        return [];
      }

      return items.map((item: any): BookInfo => ({
        id: item.id,
        title: item.volumeInfo.title ?? "不明",
        authors: item.volumeInfo.authors ?? ["不明"],
        description: item.volumeInfo.description ?? "",
        thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://"),
        publishedDate: item.volumeInfo.publishedDate,
        pageCount: item.volumeInfo.pageCount,
        categories: item.volumeInfo.categories,
      }));
    }),
});
