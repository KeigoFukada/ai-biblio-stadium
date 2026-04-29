import { config as dotenvConfig } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

// .env を強制上書きロード（Claude Code環境の空の環境変数を上書き）
const __envDir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__envDir, "../../.env"), override: true });

import express from "express";
import type { Request, Response } from "express";
import axios from "axios";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// ── テキスト前処理 ────────────────────────────────────────────────────────────
// VOICEVOX に渡す前にノイズになる記号を整理する
function cleanTextForTTS(text: string): string {
  return text
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n{2,}/g, "。")        // 連続改行 → 句点
    .replace(/[ \t]+/g, " ")         // 余分なスペースを統一
    .replace(/[""]/g, "")            // 英語引用符を除去
    .replace(/…/g, "。")             // 三点リーダー → 句点（自然な間）
    .replace(/〜/g, "から")          // チルダ → 「から」
    .replace(/\s*。\s*。\s*/g, "。") // 連続句点を1つに
    .trim();
}

// ── VOICEVOX prosody 調整 ─────────────────────────────────────────────────────
// audio_query の結果に速度・イントネーション・間を設定してから synthesis に渡す
function applyProsody(query: Record<string, unknown>, phase?: string): Record<string, unknown> {
  // ベース設定: デフォルト(1.0)より少し遅め・自然なイントネーション
  query.speedScale       = 0.91;   // 0.9〜0.95 が聞き取りやすい
  query.intonationScale  = 1.15;   // 1.1〜1.25 でメリハリが出る
  query.pitchScale       = 0.0;    // ピッチは変えない
  query.volumeScale      = 1.0;
  query.prePhonemeLength = 0.08;   // 発話前の無音（短め）
  query.postPhonemeLength= 0.14;   // 発話後の無音（自然な余韻）
  // VOICEVOX 0.14+ で利用可能：文間ポーズを少し長く
  (query as any).pauseLengthScale = 1.25;

  if (phase === "phase2") {
    // バトルアナウンス・プレゼン読み上げ: ゆっくり・表情豊か・ドラマチック
    query.speedScale      = 0.86;
    query.intonationScale = 1.25;
    (query as any).pauseLengthScale = 1.40;
    query.postPhonemeLength = 0.18;
  } else if (phase === "phase1") {
    // Q&A 質問: 明瞭で聞き取りやすい講義調
    query.speedScale      = 0.93;
    query.intonationScale = 1.10;
  }

  return query;
}

// ── VOICEVOX TTS ヘルパー ─────────────────────────────────────────────────────
async function ttsWithVoicevox(text: string, speakerId: number, phase?: string): Promise<Buffer> {
  const base = process.env.VOICEVOX_URL ?? "http://localhost:50021";
  const cleanedText = cleanTextForTTS(text);

  // Step 1: audio_query（読み・アクセント情報を生成）
  const { data: query } = await axios.post(
    `${base}/audio_query`,
    null,
    { params: { text: cleanedText, speaker: speakerId }, timeout: 10_000 }
  );

  // Step 2: prosody パラメーターを自然な発話に調整
  const adjustedQuery = applyProsody(query, phase);

  // Step 3: synthesis（音声合成 → WAV）
  const { data: wav } = await axios.post(
    `${base}/synthesis`,
    adjustedQuery,
    {
      params: { speaker: speakerId },
      headers: { "Content-Type": "application/json" },
      responseType: "arraybuffer",
      timeout: 30_000,
    }
  );

  return Buffer.from(wav);
}

// ── TTS プロキシ（VOICEVOX 優先 → ElevenLabs フォールバック）────────────────
app.post("/api/tts", async (req: Request, res: Response) => {
  const { text, phase } = req.body as { text?: string; phase?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const trimmedText = text.trim();

  // ── 1. VOICEVOX（優先）──────────────────────────────────────────────────────
  const defaultSpeaker = parseInt(process.env.VOICEVOX_SPEAKER ?? "1", 10);
  const voicevoxSpeakerByPhase: Record<string, number | undefined> = {
    phase1: process.env.VOICEVOX_SPEAKER_PHASE1
      ? parseInt(process.env.VOICEVOX_SPEAKER_PHASE1, 10) : undefined,
    phase2: process.env.VOICEVOX_SPEAKER_PHASE2
      ? parseInt(process.env.VOICEVOX_SPEAKER_PHASE2, 10) : undefined,
    phase3: process.env.VOICEVOX_SPEAKER_PHASE3
      ? parseInt(process.env.VOICEVOX_SPEAKER_PHASE3, 10) : undefined,
  };
  const speakerId: number =
    (phase ? voicevoxSpeakerByPhase[phase] : undefined) ?? defaultSpeaker;

  try {
    const wavBuffer = await ttsWithVoicevox(trimmedText, speakerId, phase);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-cache");
    res.send(wavBuffer);
    return;
  } catch {
    // VOICEVOX 未起動または失敗 → ElevenLabs にフォールバック
  }

  // ── 2. ElevenLabs（フォールバック）──────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // どちらも使えない → クライアントの Web Speech API にフォールバックさせる
    res.status(503).json({ error: "TTS service unavailable" });
    return;
  }

  const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID ?? "9BWtsMINqrJLrRacOk9x";
  const voiceIdByPhase: Record<string, string | undefined> = {
    phase1: process.env.ELEVENLABS_VOICE_ID_PHASE1,
    phase2: process.env.ELEVENLABS_VOICE_ID_PHASE2,
    phase3: process.env.ELEVENLABS_VOICE_ID_PHASE3,
  };
  const voiceId = (phase && voiceIdByPhase[phase]) ?? defaultVoiceId;

  try {
    const upstream = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: trimmedText,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.50,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "stream",
        timeout: 30_000,
      }
    );

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    (upstream.data as NodeJS.ReadableStream).pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      const status = err?.response?.status ?? 500;
      res.status(status).json({ error: "TTS request failed" });
    }
  }
});

// ── tRPC ──────────────────────────────────────────────────────────────────────
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

if (process.env.NODE_ENV === "production") {
  // ビルド後は dist/index.js が起点になるため __dirname = dist/
  // 静的ファイルは dist/public/ に置かれる
  const publicPath = resolve(__dirname, "public");
  app.use(express.static(publicPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(publicPath, "index.html"));
  });
}

app.listen(PORT, async () => {
  console.log(`🏟️  AIビブリオスタジアム サーバー起動: http://localhost:${PORT}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY が未設定です。.env ファイルを確認してください。");
  } else {
    console.log("✅ ANTHROPIC_API_KEY 読み込み完了");
  }

  // VOICEVOX 起動確認
  const voicevoxBase = process.env.VOICEVOX_URL ?? "http://localhost:50021";
  try {
    await axios.get(`${voicevoxBase}/version`, { timeout: 2_000 });
    console.log(`✅ VOICEVOX 接続確認（日本語TTS有効 / speaker=${process.env.VOICEVOX_SPEAKER ?? "1"}）`);
  } catch {
    if (process.env.ELEVENLABS_API_KEY) {
      console.log("ℹ️  VOICEVOX 未起動 → ElevenLabs TTS で動作します");
    } else {
      console.log("ℹ️  VOICEVOX 未起動・ElevenLabs 未設定 → ブラウザTTSで動作します");
    }
  }

  if (process.env.ELEVENLABS_API_KEY) {
    console.log("✅ ELEVENLABS_API_KEY 読み込み完了（VOICEVOXフォールバック用）");
  }

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    console.log("✅ GOOGLE_BOOKS_API_KEY 読み込み完了");
  } else {
    console.log("ℹ️  GOOGLE_BOOKS_API_KEY 未設定 → 書籍検索は低レートリミットで動作します");
  }
});
