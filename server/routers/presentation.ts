import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { PresentationStructure, QAQuestion, QAFeedback } from "@shared/types";

const t = initTRPC.context<object>().create({ transformer: superjson });

/** Claudeがコードブロック付きで返す場合でも安全にパースする */
function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")  // 先頭の ```json または ``` を除去
    .replace(/\s*```\s*$/,  "")        // 末尾の ``` を除去
    .trim();
  return JSON.parse(cleaned) as T;
}

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  return new Anthropic({ apiKey: key });
}

export const presentationRouter = t.router({
  generateStructures: t.procedure
    .input(
      z.object({
        bookTitle: z.string().min(1),
        bookAuthor: z.string().optional(),
        keyPoints: z.array(z.string().min(1)).min(1).max(10),
        durationMinutes: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }): Promise<PresentationStructure[]> => {
      const client = getClient();

      const prompt = `あなたはビブリオバトル（書評バトル）の達人コーチです。
以下の本について、${input.durationMinutes}分間のビブリオバトルプレゼンテーションの構成案を**3パターン**作成してください。

【本の情報】
タイトル: ${input.bookTitle}
${input.bookAuthor ? `著者: ${input.bookAuthor}` : ""}

【プレゼンターが感動したポイント（箇条書き）】
${input.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

【出力形式】
以下のJSONを厳密に返してください。コードブロックなし、JSONのみ：

[
  {
    "style": "logical",
    "styleLabel": "論理重視型",
    "styleDescription": "データと根拠で聴衆を納得させる構成",
    "openingHook": "（冒頭の一言・掴みセリフ）",
    "sections": [
      { "title": "セクション名", "duration": "〇〇秒", "content": "話す内容の詳細な説明", "tips": "コツ・注意点" }
    ],
    "closingLine": "（締めの一言）"
  },
  {
    "style": "story",
    "styleLabel": "ストーリー重視型",
    "styleDescription": "物語の流れで聴衆を引き込む構成",
    ...
  },
  {
    "style": "emotional",
    "styleLabel": "感情重視型",
    "styleDescription": "共感と感動で聴衆の心を動かす構成",
    ...
  }
]

各スタイルのsectionsは合計${input.durationMinutes}分（${input.durationMinutes * 60}秒）に収まるよう設計し、3〜4つのセクションで構成してください。
各セクションのcontentには具体的に話すべき内容を詳しく書いてください。`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      return parseJSON<PresentationStructure[]>(text);
    }),

  generateQuestions: t.procedure
    .input(
      z.object({
        bookTitle: z.string().min(1),
        presentationText: z.string().min(10),
        questionCount: z.number().min(3).max(8).default(5),
      })
    )
    .mutation(async ({ input }): Promise<QAQuestion[]> => {
      const client = getClient();

      const prompt = `あなたはビブリオバトルの熱心な観客です。
以下のプレゼンテーションを聞いて、実際のバトルで飛んできそうな質問を${input.questionCount}個作成してください。

【本のタイトル】: ${input.bookTitle}

【プレゼンテーション内容】:
${input.presentationText}

【出力形式】
以下のJSONを厳密に返してください。コードブロックなし、JSONのみ：

[
  {
    "id": "q1",
    "question": "（質問文）",
    "type": "sharp",
    "typeLabel": "鋭い質問",
    "difficulty": "hard"
  }
]

typeは以下から選択:
- "sharp"（鋭い質問）: 論理の穴をつく、深掘り系
- "curious"（素朴な疑問）: 純粋に気になること
- "clarification"（確認質問）: より詳しく聞きたいこと
- "opinion"（意見を求める）: プレゼンターの考えを聞く

difficultyは "easy" | "medium" | "hard" のいずれか。
バランスよく様々な種類の質問を混ぜてください。`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      return parseJSON<QAQuestion[]>(text);
    }),

  evaluateAnswer: t.procedure
    .input(
      z.object({
        question: z.string(),
        answer: z.string().min(1),
        bookTitle: z.string(),
        presentationText: z.string(),
      })
    )
    .mutation(async ({ input }): Promise<QAFeedback> => {
      const client = getClient();

      const prompt = `あなたはビブリオバトルの審査員です。
以下の質問への回答を評価してください。

【本】: ${input.bookTitle}
【プレゼン内容】: ${input.presentationText}
【質問】: ${input.question}
【回答】: ${input.answer}

以下のJSONを厳密に返してください。コードブロックなし、JSONのみ：

{
  "score": 75,
  "strengths": ["良かった点1", "良かった点2"],
  "improvements": ["改善点1", "改善点2"],
  "followUpSuggestion": "この回答に対して審査員がさらに聞いてきそうな追加質問"
}

scoreは0〜100の整数。前向きで建設的なフィードバックを心がけてください。`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      return parseJSON<QAFeedback>(text);
    }),
});
