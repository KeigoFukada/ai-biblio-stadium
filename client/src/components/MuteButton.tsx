import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isBGMMuted, setBGMMuted, onMuteChange } from "@/lib/audioPrefs";

/** BGM ミュートトグルボタン。クリックで即時反映（リロードなし）。 */
export function MuteButton({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(isBGMMuted);

  // 他タブや他コンポーネントからのミュート変更を受け取る
  useEffect(() => onMuteChange(setMuted), []);

  const toggle = () => setBGMMuted(!muted); // リスナー経由で setMuted が呼ばれる

  return (
    <button
      onClick={toggle}
      title={muted ? "BGMをオンにする" : "BGMをオフにする"}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all ${className}`}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
