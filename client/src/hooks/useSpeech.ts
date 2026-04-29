import { useState, useCallback, useRef, useEffect } from "react";

// ── 音声認識 ──────────────────────────────────────────────────────────────────
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      setTranscript(full);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      if (e.error !== "aborted") setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
  }, []);

  return { isListening, transcript, isSupported, start, stop, reset };
}

// ── 音声合成（ElevenLabs 優先 → Web Speech API フォールバック）─────────────────
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Web Speech API 用
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ElevenLabs 用
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  // アンマウント時に全リソースを解放
  useEffect(() => {
    return () => {
      cleanupWebSpeech();
      cleanupAudio();
    };
  }, []);

  // ── クリーンアップヘルパー ──────────────────────────────────────────────────
  const cleanupWebSpeech = () => {
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
  };

  // ── Web Speech API フォールバック ──────────────────────────────────────────
  const speakWithWebSpeech = useCallback((text: string, phase?: string) => {
    if (!("speechSynthesis" in window)) return;

    // cancel 直後に speak すると動かないブラウザ対策で 50ms 待つ
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";

      // 利用可能な日本語ボイスを優先的に選択（ローカル音声 > リモート）
      const voices = window.speechSynthesis.getVoices();
      const jpVoice =
        voices.find((v) => v.lang === "ja-JP" && v.localService) ??
        voices.find((v) => v.lang.startsWith("ja"));
      if (jpVoice) utterance.voice = jpVoice;

      // フェーズ別パラメータ（phase2 = バトルアナウンス・プレゼン: ゆっくり・ドラマチック）
      if (phase === "phase2") {
        utterance.rate  = 0.82;   // ゆっくり・聞き取りやすい
        utterance.pitch = 1.05;   // 少し高め・表情豊か
      } else if (phase === "phase1") {
        utterance.rate  = 0.88;   // 明瞭・講義調
        utterance.pitch = 1.0;
      } else {
        utterance.rate  = 0.88;
        utterance.pitch = 1.0;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }, 50);
  }, []);

  // ── メイン speak（ElevenLabs → Web Speech API フォールバック）────────────────
  const speak = useCallback(
    async (text: string, phase?: string) => {
      // 既存の読み上げを全停止
      cleanupWebSpeech();
      cleanupAudio();
      setIsSpeaking(true); // 楽観的に「読み上げ中」を表示

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, phase }),
        });

        if (!response.ok) {
          // ElevenLabs 未設定 or エラー → Web Speech API にフォールバック
          setIsSpeaking(false);
          speakWithWebSpeech(text, phase);
          return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        audioBlobUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (audioBlobUrlRef.current) {
            URL.revokeObjectURL(audioBlobUrlRef.current);
            audioBlobUrlRef.current = null;
          }
        };
        audio.onerror = () => {
          // Audio 再生エラー → Web Speech API にフォールバック
          setIsSpeaking(false);
          audioRef.current = null;
          speakWithWebSpeech(text, phase);
        };

        audio.play();
      } catch {
        // ネットワークエラー等 → Web Speech API にフォールバック
        setIsSpeaking(false);
        speakWithWebSpeech(text, phase);
      }
    },
    [speakWithWebSpeech]
  );

  // ── 停止 ────────────────────────────────────────────────────────────────────
  const cancel = useCallback(() => {
    cleanupWebSpeech();
    cleanupAudio();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, cancel };
}
