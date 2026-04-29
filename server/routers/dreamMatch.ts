import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { DreamCharacter, CharacterPresentation, DreamBattle } from "@shared/types";

const t = initTRPC.context<object>().create({ transformer: superjson });

function parseJSON<T>(text: string): T {
  // コードブロックを除去して trimming
  let s = text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // そのままパースを試みる
  try { return JSON.parse(s) as T; } catch {}

  // Claude が前置き文を付けた場合、最初の { から最後の } を抽出して再試行
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]) as T; } catch {}
  }

  // 最終手段: 改行・制御文字をエスケープして再試行
  try {
    const escaped = s.replace(/[\x00-\x1F\x7F]/g, (c) =>
      c === "\n" || c === "\r" || c === "\t" ? c : ""
    );
    const m2 = escaped.match(/\{[\s\S]*\}/);
    if (m2) return JSON.parse(m2[0]) as T;
  } catch {}

  console.error("[dreamMatch] JSON parse failed. Raw text:", s.slice(0, 500));
  throw new Error("AIの応答をJSONとして解析できませんでした。もう一度お試しください。");
}

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  return new Anthropic({ apiKey: key });
}

// ── キャラクター定義 ──────────────────────────────────────────
export const CHARACTERS: Record<string, DreamCharacter> = {
  dazai: {
    id: "dazai",
    name: "太宰治",
    era: "昭和初期",
    style: "退廃・詩的・自嘲",
    avatar: "🖋️",
    gradientFrom: "from-rose-600",
    gradientTo: "to-rose-900",
    accentColor: "#f43f5e",
  },
  soseki: {
    id: "soseki",
    name: "夏目漱石",
    era: "明治期",
    style: "知的・社会批評・品格",
    avatar: "📖",
    gradientFrom: "from-amber-500",
    gradientTo: "to-amber-900",
    accentColor: "#f59e0b",
  },
  kenji: {
    id: "kenji",
    name: "宮沢賢治",
    era: "大正・昭和初期",
    style: "幻想・詩的・純粋",
    avatar: "🌌",
    gradientFrom: "from-indigo-500",
    gradientTo: "to-indigo-900",
    accentColor: "#818cf8",
  },
  akutagawa: {
    id: "akutagawa",
    name: "芥川龍之介",
    era: "大正期",
    style: "鋭利・簡潔・人間の業",
    avatar: "⚔️",
    gradientFrom: "from-emerald-600",
    gradientTo: "to-emerald-900",
    accentColor: "#10b981",
  },
};

// ── キャラクタープロンプト ─────────────────────────────────────
const CHARACTER_PROMPTS: Record<string, string> = {
  dazai: `あなたは作家・太宰治として話してください。退廃的で自嘲的でありながら、美しく詩的な文体でビブリオバトルのプレゼンをしてください。「〜ですよ」「〜でしょう」という語り口、自分の弱さへの言及、それでも本を薦めずにいられない純粋さを込めて。「恥の多い生涯を送ってきましたが」のような出だしも効果的です。`,
  soseki: `あなたは作家・夏目漱石として話してください。知的で品格があり、明治の教養人の視点でビブリオバトルのプレゼンをしてください。「余は〜」「諸君」といった表現を適度に交え、社会への洞察とユーモア、人間の業への共感を込めて。`,
  kenji: `あなたは詩人・宮沢賢治として話してください。幻想的で詩的、自然と宇宙への愛を込めてビブリオバトルのプレゼンをしてください。「ほんとうの幸いとは」「銀河の彼方から見れば」といった壮大な視点を持ちながら、純粋で力強い言葉で語りかけてください。`,
  akutagawa: `あなたは作家・芥川龍之介として話してください。鋭利で簡潔、人間の業と矛盾を見抜く眼力でビブリオバトルのプレゼンをしてください。無駄な言葉を削ぎ落とし、本質を一刀両断するように。「人生は一行のボードレールにも若かない」のような切れ味のある言葉で。`,
};

// ── バトル用書籍プリセット ────────────────────────────────────
export const BATTLE_BOOKS = [
  // 現代小説
  { title: "嫌われる勇気", author: "岸見一郎・古賀史健" },
  { title: "君の膵臓をたべたい", author: "住野よる" },
  { title: "流浪の月", author: "凪良ゆう" },
  { title: "52ヘルツのクジラたち", author: "町田そのこ" },
  { title: "そして、バトンは渡された", author: "瀬尾まいこ" },
  { title: "汝、星のごとく", author: "凪良ゆう" },
  { title: "同志少女よ、敵を撃て", author: "逢坂冬馬" },
  { title: "推し、燃ゆ", author: "宇佐見りん" },
  { title: "成瀬は天下を取りにいく", author: "宮島未奈" },
  { title: "夜が明ける", author: "西加奈子" },
  { title: "コンビニ人間", author: "村田沙耶香" },
  { title: "博士の愛した数式", author: "小川洋子" },
  { title: "蜜蜂と遠雷", author: "恩田陸" },
  { title: "人間失格", author: "太宰治" },
  { title: "本日はお日柄もよく", author: "原田マハ" },
  { title: "運転者", author: "喜多川泰" },
  { title: "夜は短し歩けよ乙女", author: "森見登美彦" },
  { title: "かがみの孤城", author: "辻村深月" },
  { title: "阪急電車", author: "有川浩" },
  // 思考・教養・アート
  { title: "13歳からのアート思考", author: "末永幸歩" },
  { title: "孤独力", author: "齋藤孝" },
  { title: "サピエンス全史", author: "ユヴァル・ノア・ハラリ" },
  { title: "ファクトフルネス", author: "ハンス・ロスリング" },
  { title: "ゼロ・トゥ・ワン", author: "ピーター・ティール" },
  // 詩・エッセイ
  { title: "あなたのための短歌集", author: "木下龍也" },
  { title: "星の王子さま", author: "アントワーヌ・ド・サン=テグジュペリ" },
];

// ── インメモリ投票ストア ───────────────────────────────────────
const voteStore = new Map<string, [number, number]>();

// ── プレゼン生成 ──────────────────────────────────────────────
async function generatePresentation(
  client: Anthropic,
  characterId: string,
  bookTitle: string,
  bookAuthor: string
): Promise<CharacterPresentation> {
  const character = CHARACTERS[characterId];
  const characterPrompt = CHARACTER_PROMPTS[characterId];

  if (!character || !characterPrompt) {
    throw new Error(`不明なキャラクターIDです: ${characterId}`);
  }

  const prompt = `${characterPrompt}

【紹介する本】
タイトル: 「${bookTitle}」
著者: ${bookAuthor}

【絶対に守ること】
- 必ず { で始まり } で終わるJSONのみを出力してください
- 前置き・説明文・コードブロック（\`\`\`）は一切不要です
- 以下のキーをすべて含めてください: opening / body / closing / recommendation

{"opening":"（あなたらしい冒頭の一言。キャラクターの個性が出るインパクトのある掴みセリフ。1〜2文）","body":"（2分程度のプレゼン本文。キャラクターの文体・口調でこの本の魅力を語る。350〜450文字程度）","closing":"（締めの一言。キャラクターらしく力強く短く）","recommendation":"（この本はこんな人に読んでほしい、を1文で。キャラクターらしく）"}`;

  let message;
  try {
    message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err: any) {
    console.error(`[dreamMatch] Anthropic API error for ${characterId}:`, err?.message ?? err);
    throw new Error(
      err?.message?.includes("API_KEY") || err?.status === 401
        ? "APIキーを確認してください。"
        : `AI生成に失敗しました (${characterId}): ${err?.message ?? "不明なエラー"}`
    );
  }

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  if (!text.trim()) throw new Error("AIからの応答が空です。もう一度お試しください。");

  let parsed: { opening: string; body: string; closing: string; recommendation: string };
  try {
    parsed = parseJSON<typeof parsed>(text);
  } catch (err: any) {
    console.error(`[dreamMatch] JSON parse error for ${characterId}. text=`, text.slice(0, 300));
    throw new Error("AIの応答形式が不正でした。もう一度お試しください。");
  }

  // フィールド存在チェック（空文字も不可）
  const missing = (["opening", "body", "closing", "recommendation"] as const).filter(
    (k) => !parsed[k]?.trim()
  );
  if (missing.length > 0) {
    console.error(`[dreamMatch] Missing fields: ${missing.join(", ")}. parsed=`, parsed);
    throw new Error(`AIの応答が不完全でした（${missing.join("/")}が空）。もう一度お試しください。`);
  }

  return {
    character,
    bookTitle,
    bookAuthor,
    opening: parsed.opening.trim(),
    body: parsed.body.trim(),
    closing: parsed.closing.trim(),
    recommendation: parsed.recommendation.trim(),
  };
}

// ── ルーター ──────────────────────────────────────────────────
export const dreamMatchRouter = t.router({
  getCharacters: t.procedure.query(async (): Promise<DreamCharacter[]> => {
    return Object.values(CHARACTERS);
  }),

  getBattleBooks: t.procedure.query(async (): Promise<{ title: string; author: string }[]> => {
    return BATTLE_BOOKS;
  }),

  generateBattle: t.procedure
    .input(
      z.object({
        book1: z.object({ title: z.string(), author: z.string() }),
        book2: z.object({ title: z.string(), author: z.string() }),
        character1Id: z.string(),
        character2Id: z.string(),
        battleId: z.string(),
      })
    )
    .mutation(async ({ input }): Promise<DreamBattle> => {
      const client = getClient();
      console.log(`[dreamMatch] start: ${input.character1Id}(${input.book1.title}) vs ${input.character2Id}(${input.book2.title})`);

      // 90秒タイムアウト付きで2キャラクターのプレゼンを並列生成
      let side1: CharacterPresentation;
      let side2: CharacterPresentation;
      try {
        const timeoutPromise = new Promise<[CharacterPresentation, CharacterPresentation]>(
          (_, reject) => setTimeout(() => reject(new Error("生成がタイムアウトしました（90秒）。もう一度お試しください。")), 90_000)
        );
        const generatePromise = Promise.all([
          generatePresentation(client, input.character1Id, input.book1.title, input.book1.author),
          generatePresentation(client, input.character2Id, input.book2.title, input.book2.author),
        ]);
        [side1, side2] = await Promise.race([generatePromise, timeoutPromise]);
      } catch (err: any) {
        console.error("[dreamMatch] generateBattle failed:", err?.message);
        throw err;
      }

      const votes = voteStore.get(input.battleId) ?? [0, 0];
      console.log(`[dreamMatch] done: ${input.battleId}`);

      return {
        id: input.battleId,
        side1,
        side2,
        votes1: votes[0],
        votes2: votes[1],
      };
    }),

  vote: t.procedure
    .input(
      z.object({
        battleId: z.string(),
        side: z.enum(["1", "2"]),
      })
    )
    .mutation(async ({ input }): Promise<{ votes1: number; votes2: number }> => {
      const current = voteStore.get(input.battleId) ?? [0, 0];
      const updated: [number, number] =
        input.side === "1"
          ? [current[0] + 1, current[1]]
          : [current[0], current[1] + 1];
      voteStore.set(input.battleId, updated);
      return { votes1: updated[0], votes2: updated[1] };
    }),

  getVotes: t.procedure
    .input(z.object({ battleId: z.string() }))
    .query(async ({ input }): Promise<{ votes1: number; votes2: number }> => {
      const votes = voteStore.get(input.battleId) ?? [0, 0];
      return { votes1: votes[0], votes2: votes[1] };
    }),
});
