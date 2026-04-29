import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { Battler, BattlerPick } from "@shared/types";

const t = initTRPC.context<object>().create({ transformer: superjson });

function parseJSON<T>(text: string): T {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY が設定されていません");
  return new Anthropic({ apiKey: key });
}

// ── バトラー定義 ───────────────────────────────────────────────
export const BATTLERS: Record<string, Battler> = {
  ryo: {
    id: "ryo",
    name: "リョウ",
    emoji: "🚀",
    tagline: "役に立つ本しか推薦しない",
    accentColor: "#06b6d4",
    gradientFrom: "from-cyan-500",
    gradientTo: "to-cyan-800",
  },
  mika: {
    id: "mika",
    name: "ミカ",
    emoji: "📚",
    tagline: "この本で泣ける自分が好き",
    accentColor: "#ec4899",
    gradientFrom: "from-pink-500",
    gradientTo: "to-pink-900",
  },
  ken: {
    id: "ken",
    name: "ケン",
    emoji: "🔬",
    tagline: "面白さには必ず理由がある",
    accentColor: "#818cf8",
    gradientFrom: "from-indigo-500",
    gradientTo: "to-indigo-900",
  },
  haru: {
    id: "haru",
    name: "ハル",
    emoji: "🌿",
    tagline: "昨日読んだ。今日また読んだ",
    accentColor: "#10b981",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-emerald-900",
  },
};

// ── バトラープロンプト ─────────────────────────────────────────
const BATTLER_PROMPTS: Record<string, string> = {
  ryo: `あなたは27歳のプロダクトマネージャー・リョウです。実用的で即効性のある本を厳選して推薦するリアリストです。「この本で○○が変わった」という実体験ベースのプレゼンが得意で、ビジネス的な視点から本の価値を語ります。語り口は親しみやすく、テンポよくスマートです。難しいことを簡単に伝えるのが得意。`,
  mika: `あなたは25歳の書店員・ミカです。本との出会いを宝物のように大切にし、感情に正直なプレゼンが得意です。読んで心が動いた瞬間を丁寧に語り、「なんでこんなに刺さるんだろう」という共感を大切にします。語り口は優しく少し詩的。「ねえ聞いて」から始まるような距離感の近さがあります。`,
  ken: `あなたは30歳のデータサイエンティスト・ケンです。「なぜこの本が面白いのか」を論理的に分析するのが得意ですが、本への熱量は誰にも負けません。構造や仕組みの話をしながら最終的には「読め」と言い放つスタイル。でも押しつけではなく、根拠があるから説得力がある。`,
  haru: `あなたは28歳のフリーランサー・ハルです。生活の中で本と向き合い、日常に寄り添う読書を大切にしています。「これ、朝コーヒー飲みながら読んでほしい」みたいな生活密着型のプレゼンが得意で、押しつけがましくない穏やかな語り口です。ちょっとゆるくて、でも本当に好きな気持ちがにじみ出る感じ。`,
};

// ── 書籍プール（Phase 3）──────────────────────────────────────
const BOOK_POOL = [
  // 現代小説・青春
  { title: "嫌われる勇気", author: "岸見一郎・古賀史健" },
  { title: "君の膵臓をたべたい", author: "住野よる" },
  { title: "流浪の月", author: "凪良ゆう" },
  { title: "52ヘルツのクジラたち", author: "町田そのこ" },
  { title: "そして、バトンは渡された", author: "瀬尾まいこ" },
  { title: "汝、星のごとく", author: "凪良ゆう" },
  { title: "同志少女よ、敵を撃て", author: "逢坂冬馬" },
  { title: "推し、燃ゆ", author: "宇佐見りん" },
  { title: "成瀬は天下を取りにいく", author: "宮島未奈" },
  { title: "コンビニ人間", author: "村田沙耶香" },
  { title: "博士の愛した数式", author: "小川洋子" },
  { title: "蜜蜂と遠雷", author: "恩田陸" },
  { title: "人間失格", author: "太宰治" },
  { title: "夜は短し歩けよ乙女", author: "森見登美彦" },
  { title: "容疑者Xの献身", author: "東野圭吾" },
  { title: "かがみの孤城", author: "辻村深月" },
  { title: "阪急電車", author: "有川浩" },
  { title: "本日はお日柄もよく", author: "原田マハ" },
  { title: "運転者", author: "喜多川泰" },
  { title: "夜が明ける", author: "西加奈子" },
  // 思考・教養・ビジネス
  { title: "13歳からのアート思考", author: "末永幸歩" },
  { title: "孤独力", author: "齋藤孝" },
  { title: "サピエンス全史", author: "ユヴァル・ノア・ハラリ" },
  { title: "ファクトフルネス", author: "ハンス・ロスリング" },
  { title: "Think clearly", author: "ロルフ・ドベリ" },
  { title: "ゼロ・トゥ・ワン", author: "ピーター・ティール" },
  { title: "チーズはどこへ消えた？", author: "スペンサー・ジョンソン" },
  // 詩・海外文学・古典
  { title: "あなたのための短歌集", author: "木下龍也" },
  { title: "星の王子さま", author: "アントワーヌ・ド・サン=テグジュペリ" },
  { title: "アルケミスト", author: "パウロ・コエーリョ" },
  { title: "百年の孤独", author: "ガブリエル・ガルシア＝マルケス" },
  { title: "ノルウェイの森", author: "村上春樹" },
  { title: "1984年", author: "ジョージ・オーウェル" },
  { title: "ハリー・ポッターと賢者の石", author: "J・K・ローリング" },
];

// ── ピック生成 ────────────────────────────────────────────────
async function generatePick(
  client: Anthropic,
  battlerId: string,
  book: { title: string; author: string },
  preferenceHint: string
): Promise<BattlerPick> {
  const battler = BATTLERS[battlerId];
  const battlerPrompt = BATTLER_PROMPTS[battlerId];

  const prompt = `${battlerPrompt}
${preferenceHint ? `\n【ユーザーの傾向（参考）】\n${preferenceHint}\n` : ""}
【あなたが紹介する本】
タイトル: 「${book.title}」
著者: ${book.author}

【出力形式】
以下のJSONを厳密に返してください。コードブロックなし、JSONのみ：

{
  "hook": "（1文の掴みセリフ。30文字前後。あなたらしさ全開で）",
  "pitch": "（2〜3文のプレゼン本文。あなたの文体で、この本の魅力を語る。150文字前後）",
  "target": "（「○○な人に読んでほしい」を1文で。40文字前後）",
  "keyword": "（この本を表す1ワード。例：「勇気」「発見」「共感」「成長」など）"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  if (!text) throw new Error("AIからの応答が空です。もう一度お試しください。");

  let parsed: { hook: string; pitch: string; target: string; keyword: string };
  try {
    parsed = parseJSON<typeof parsed>(text);
  } catch {
    throw new Error("AIの応答形式が不正でした。もう一度お試しください。");
  }

  if (!parsed.hook || !parsed.pitch || !parsed.target || !parsed.keyword) {
    throw new Error("AIの応答が不完全でした。もう一度お試しください。");
  }

  return {
    battler,
    bookTitle: book.title,
    bookAuthor: book.author,
    hook: parsed.hook,
    pitch: parsed.pitch,
    target: parsed.target,
    keyword: parsed.keyword,
  };
}

// ── ルーター ──────────────────────────────────────────────────
export const battlerRouter = t.router({
  getBattlers: t.procedure.query(async (): Promise<Battler[]> => {
    return Object.values(BATTLERS);
  }),

  generatePicks: t.procedure
    .input(
      z.object({
        // ユーザーの好み（localStorage から渡す）
        preferredBattlers: z.array(z.string()).optional(),
        preferredKeywords: z.array(z.string()).optional(),
        sessionCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }): Promise<BattlerPick[]> => {
      const client = getClient();

      // 4冊をランダムで選択（重複なし）
      const shuffled = [...BOOK_POOL].sort(() => Math.random() - 0.5);
      const books = shuffled.slice(0, 4);

      // バトラー順序（好みに基づいて微調整 - 多く投票されたバトラーを最初に）
      const battlerIds = ["ryo", "mika", "ken", "haru"];
      if (input.preferredBattlers && input.preferredBattlers.length > 0) {
        battlerIds.sort((a, b) => {
          const aIdx = input.preferredBattlers!.indexOf(a);
          const bIdx = input.preferredBattlers!.indexOf(b);
          return (bIdx === -1 ? -1 : bIdx) - (aIdx === -1 ? -1 : aIdx);
        });
      }

      // ユーザー傾向のヒント文
      const preferenceHint =
        input.preferredKeywords && input.preferredKeywords.length > 0
          ? `このユーザーはこれまで「${input.preferredKeywords.slice(0, 5).join("・")}」といったキーワードの本に投票してきました。傾向を参考にしつつも、新しい発見も提供してください。`
          : "";

      // 4バトラーを並列生成
      const picks = await Promise.all(
        battlerIds.map((id, i) => generatePick(client, id, books[i], preferenceHint))
      );

      return picks;
    }),
});
