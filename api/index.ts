import express from "express";
import type { Request, Response } from "express";
import axios from "axios";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";

const app = express();
app.use(express.json());

// ── TTS プロキシ（ElevenLabs → Web Speech API フォールバック）────────────────
// ※ Vercel 環境では VOICEVOX は使用不可のため ElevenLabs のみ
app.post("/api/tts", async (req: Request, res: Response) => {
  const { text, phase } = req.body as { text?: string; phase?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const trimmedText = text.trim();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // ElevenLabs 未設定 → クライアントの Web Speech API にフォールバックさせる
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

export default app;
