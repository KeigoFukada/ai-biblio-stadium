/**
 * useSceneBGM — Tone.js によるシーン別 BGM
 *
 * 各シーンに「キャッチーなメロディー + ベースライン + リバーブ」を実装。
 * ドローン音は一切なし。すべての音符は ADSR エンベロープで自然に消える。
 */
import * as Tone from "tone";
import { useEffect, useRef, useState } from "react";
import { isBGMMuted, onMuteChange } from "@/lib/audioPrefs";

// ─────────────────────────────────────────────────────────────────────────────
// シーン定義
//   melody / bass: Tone.js 音名 ("C5", "F#4" …) | null = 休符
//   oscillator: "triangle" | "sine" | "square" | "sawtooth"
// ─────────────────────────────────────────────────────────────────────────────
interface SceneDef {
  bpm: number;
  melody: (string | null)[];
  bass:   (string | null)[];
  vol: number;       // dBFS (0 = フル、-30 = かなり小さい)
  oscillator: "triangle" | "sine" | "square" | "sawtooth";
  attack: number; decay: number; sustain: number; release: number;
  reverbWet: number;
}

const SCENES: Record<string, SceneDef> = {
  /**
   * ホーム — 穏やか・知的 (Cメジャー 100BPM)
   * メロディー例: ドーミーソーラ ソーミーレード ミーソーラード シーラーソー休
   */
  home: {
    bpm: 100,
    melody: [
      "C5","E5","G5","A5", "G5","E5","D5","C5",
      "E5","G5","A5","C6", "B5","A5","G5", null,
    ],
    bass: [
      "C3", null, null, null,  "G2", null, null, null,
      "A2", null, null, null,  "F2", null, null, null,
    ],
    vol: -22, oscillator: "triangle",
    attack: 0.02, decay: 0.5, sustain: 0.1, release: 1.5,
    reverbWet: 0.40,
  },

  /**
   * プレゼン補助 — 落ち着いた集中 (Gメジャー 80BPM)
   * ゆっくりとした穏やかなループ
   */
  assist: {
    bpm: 80,
    melody: [
      "G4","B4","D5","G5", "D5","B4","A4","G4",
      "B4","D5","E5","D5", "C5","B4","A4", null,
    ],
    bass: [
      "G2", null, null, null,  "D2", null, null, null,
      "C2", null, null, null,  "D2", null, null, null,
    ],
    vol: -24, oscillator: "sine",
    attack: 0.03, decay: 0.8, sustain: 0.15, release: 2.0,
    reverbWet: 0.45,
  },

  /**
   * Q&A練習 — 適度な緊張感 (Aナチュラルマイナー 110BPM)
   * マイナーキーで集中感を演出
   */
  qa: {
    bpm: 110,
    melody: [
      "A4","C5","E5","G5", "F5","E5","D5","C5",
      "E5","A4","C5","E5", "G5","F5","E5", null,
    ],
    bass: [
      "A2", null, null, null,  "F2", null, null, null,
      "C2", null, null, null,  "E2", null, null, null,
    ],
    vol: -22, oscillator: "triangle",
    attack: 0.01, decay: 0.4, sustain: 0.1, release: 1.0,
    reverbWet: 0.35,
  },

  /**
   * ドリームマッチ 選択画面 — わくわく・期待感 (Cメジャー 128BPM)
   * 明るく跳ねるフレーズ。高音域への跳躍でワクワク感を演出
   */
  "dream-setup": {
    bpm: 128,
    melody: [
      "C5","E5","G5","C6", "B5","G5","E5","G5",
      "A5","C6","B5","A5", "G5","E5","D5","E5",
    ],
    bass: [
      "C3", null, "G2", null,  "E2", null, "G2", null,
      "A2", null, "F2", null,  "G2", null,  null, null,
    ],
    vol: -20, oscillator: "sawtooth",
    attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6,
    reverbWet: 0.30,
  },

  /**
   * ドリームマッチ バトル中 — 重厚・壮大 (Aマイナー 145BPM)
   * ドラマチックなマイナーアルペジオ。バトルの緊張感を盛り上げる
   */
  "dream-battle": {
    bpm: 145,
    melody: [
      "A4","E5","D5","C5", "B4","C5","D5","E5",
      "F5","E5","D5","C5", "B4", null,"A4", null,
    ],
    bass: [
      "A2", null, "E2", null,  "F2", null, "E2", null,
      "D2", null, "E2", null,  "A2", null,  null, null,
    ],
    vol: -21, oscillator: "square",
    attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.5,
    reverbWet: 0.25,
  },

  /**
   * バトラー投票 — 明るく軽やか (Dメジャー 120BPM)
   * D-F#-A のペンタで弾む感じ。投票する楽しさを演出
   */
  battler: {
    bpm: 120,
    melody: [
      "D5","F#5","A5","B5", "A5","F#5","E5","D5",
      "F#5","A5","B5","D6", "A5", null,"F#5", null,
    ],
    bass: [
      "D3", null, "A2", null,  "G2", null, "A2", null,
      "B2", null, "G2", null,  "D2", null,  null, null,
    ],
    vol: -21, oscillator: "triangle",
    attack: 0.01, decay: 0.35, sustain: 0.1, release: 1.2,
    reverbWet: 0.35,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// フック本体
// ─────────────────────────────────────────────────────────────────────────────
export function useSceneBGM(scene: keyof typeof SCENES | null) {
  const disposeRef = useRef<(() => void) | null>(null);
  const [muted, setMuted] = useState(isBGMMuted);

  // ミュートボタン押下で即時停止/再開
  useEffect(() => onMuteChange(setMuted), []);

  useEffect(() => {
    if (muted || !scene) return;
    const cfg = SCENES[scene];
    if (!cfg) return;

    let cancelled = false;

    (async () => {
      // Chrome autoplay policy: require user gesture → Tone.start() handles it
      try { await Tone.start(); } catch { return; }
      if (cancelled) return;

      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);
      transport.bpm.value = cfg.bpm;

      // ── エフェクトチェーン ──────────────────────────────────
      const reverb    = new Tone.Reverb({ decay: 2.5, wet: cfg.reverbWet });
      const masterVol = new Tone.Volume(cfg.vol);
      masterVol.toDestination();
      reverb.connect(masterVol);

      // ── メロディ音源 ────────────────────────────────────────
      const melodySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: cfg.oscillator },
        envelope: {
          attack:  cfg.attack,
          decay:   cfg.decay,
          sustain: cfg.sustain,
          release: cfg.release,
        },
      });
      melodySynth.connect(reverb);

      // ── ベース音源 ──────────────────────────────────────────
      const bassSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 2.0 },
      });
      const bassBoost = new Tone.Volume(6);
      bassSynth.chain(bassBoost, reverb);

      // ── シーケンス ──────────────────────────────────────────
      const melodySeq = new Tone.Sequence(
        (time, note) => { if (note) melodySynth.triggerAttackRelease(note, "8n", time); },
        cfg.melody, "8n"
      );
      const bassSeq = new Tone.Sequence(
        (time, note) => { if (note) bassSynth.triggerAttackRelease(note, "4n", time); },
        cfg.bass, "8n"
      );
      melodySeq.start(0);
      bassSeq.start(0);
      transport.start("+0.05");

      disposeRef.current = () => {
        [melodySeq, bassSeq].forEach(s => { try { s.stop(); s.dispose(); } catch {} });
        melodySynth.dispose();
        bassSynth.dispose();
        bassBoost.dispose();
        reverb.dispose();
        masterVol.dispose();
        transport.stop();
      };
    })().catch(() => {});

    return () => {
      cancelled = true;
      disposeRef.current?.();
      disposeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, muted]);
}
