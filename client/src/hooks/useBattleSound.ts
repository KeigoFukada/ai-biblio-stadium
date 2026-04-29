/**
 * useBattleSound — Tone.js による「バトル準備中」専用 BGM
 *
 * ドラムパターン + バスライン + 疾走感のあるメロディーで
 * RPG バトル開幕のような緊張感と高揚感を演出。
 */
import * as Tone from "tone";
import { useEffect, useRef, useState } from "react";
import { isBGMMuted, onMuteChange } from "@/lib/audioPrefs";

// ─────────────────────────────────────────────────────────────────────────────
// バトルテーマ: Aマイナー 155BPM
// ─────────────────────────────────────────────────────────────────────────────
const MELODY: (string | null)[] = [
  "E5","D5","C5","B4",  "C5","D5","E5", null,
  "A4","C5","E5","G5",  "F5","E5","D5", null,
];
const BASS: (string | null)[] = [
  "A2", null, "E2", null,  "F2", null, "G2", null,
  "A2", null, "C3", null,  "F2", null, "E2", null,
];
// 1 = 打つ / 0 = 休符  (8th note ベース、2小節 = 16ステップ)
const KICK: (1|0)[] = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0];
const SNARE: (1|0)[] = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const HIHAT: (1|0)[] = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0];

// ─────────────────────────────────────────────────────────────────────────────
export function useBattleSound(active: boolean) {
  const disposeRef = useRef<(() => void) | null>(null);
  const [muted, setMuted] = useState(isBGMMuted);

  useEffect(() => onMuteChange(setMuted), []);

  useEffect(() => {
    // 非アクティブ or ミュート → 即停止
    if (!active || muted) {
      disposeRef.current?.();
      disposeRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try { await Tone.start(); } catch { return; }
      if (cancelled) return;

      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);
      transport.bpm.value = 155;

      // ── エフェクト ─────────────────────────────────────────
      const reverb    = new Tone.Reverb({ decay: 1.2, wet: 0.20 });
      const masterVol = new Tone.Volume(-16);
      masterVol.toDestination();
      reverb.connect(masterVol);

      // ── メロディ (スクウェア波 → ゲームっぽい疾走感) ────────
      const leadSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.4 },
      });
      leadSynth.connect(reverb);

      // ── ベース (サウとウェーブ) ─────────────────────────────
      const bassSynth = new Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      });
      const bassVol = new Tone.Volume(3);
      bassSynth.chain(bassVol, reverb);

      // ── キックドラム ────────────────────────────────────────
      const kick    = new Tone.MembraneSynth({
        pitchDecay: 0.06, octaves: 8,
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      });
      const kickVol = new Tone.Volume(-8);
      kick.chain(kickVol, masterVol);

      // ── スネア (MetalSynth を低めに) ───────────────────────
      const snare    = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      });
      const snareFilter = new Tone.BiquadFilter(3500, "bandpass");
      const snareVol    = new Tone.Volume(-14);
      snare.chain(snareFilter, snareVol, masterVol);

      // ── ハイハット ──────────────────────────────────────────
      const hat    = new Tone.MetalSynth({
        harmonicity: 5.1, modulationIndex: 32,
        resonance: 4000, octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      } as any);
      const hatVol = new Tone.Volume(-24);
      hat.chain(hatVol, masterVol);

      // ── シーケンス ──────────────────────────────────────────
      const melodySeq = new Tone.Sequence(
        (t, n) => { if (n) leadSynth.triggerAttackRelease(n, "8n", t); },
        MELODY, "8n"
      );
      const bassSeq = new Tone.Sequence(
        (t, n) => { if (n) bassSynth.triggerAttackRelease(n, "4n", t); },
        BASS, "8n"
      );
      const kickSeq = new Tone.Sequence(
        (t, v) => { if (v) kick.triggerAttackRelease("C1", "8n", t); },
        KICK, "8n"
      );
      const snareSeq = new Tone.Sequence(
        (t, v) => { if (v) snare.triggerAttackRelease("8n", t); },
        SNARE, "8n"
      );
      const hatSeq = new Tone.Sequence(
        (t, v) => { if (v) hat.triggerAttackRelease(0.03, t); },
        HIHAT, "8n"
      );

      const seqs = [melodySeq, bassSeq, kickSeq, snareSeq, hatSeq];
      seqs.forEach(s => s.start(0));
      transport.start("+0.05");

      disposeRef.current = () => {
        seqs.forEach(s => { try { s.stop(); s.dispose(); } catch {} });
        leadSynth.dispose();
        bassSynth.dispose();
        bassVol.dispose();
        kick.dispose(); kickVol.dispose();
        snare.dispose(); snareFilter.dispose(); snareVol.dispose();
        hat.dispose(); hatVol.dispose();
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
  }, [active, muted]);
}
