import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, RefreshCw, Heart, Sparkles, BookOpen, Zap, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { BattlerPick, BattlerPreference } from "@shared/types";
import { useSceneBGM } from "@/hooks/useSceneBGM";
import { MuteButton } from "@/components/MuteButton";

/** AIが返すテキストに含まれる先頭・末尾の鍵括弧を除去（二重括弧防止） */
function sq(text: string): string {
  return text.replace(/^[「『]/, "").replace(/[」』]$/, "");
}

// ── LocalStorage ───────────────────────────────────────────────────────────────
const PREF_KEY = "battlerPreference";

function loadPreference(): BattlerPreference {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw) as BattlerPreference;
  } catch {}
  return { battlerVotes: {}, keywords: [], sessionCount: 0 };
}

function savePreference(pref: BattlerPreference) {
  localStorage.setItem(PREF_KEY, JSON.stringify(pref));
}

function topBattlerIds(votes: Record<string, number>): string[] {
  return Object.entries(votes)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);
}

// バトラーメタ（アイコン・色の静的定義）
const BATTLER_META: Record<string, { name: string; emoji: string; color: string }> = {
  ryo:  { name: "リョウ",  emoji: "🚀", color: "#06b6d4" },
  mika: { name: "ミカ",    emoji: "📚", color: "#ec4899" },
  ken:  { name: "ケン",    emoji: "🔬", color: "#818cf8" },
  haru: { name: "ハル",    emoji: "🌿", color: "#10b981" },
};

// ── ローディングカード ─────────────────────────────────────────────────────────
const LOADING_GRADIENTS = [
  "from-cyan-600/25 to-cyan-900/10",
  "from-pink-600/25 to-pink-900/10",
  "from-indigo-600/25 to-indigo-900/10",
  "from-emerald-600/25 to-emerald-900/10",
];

function LoadingCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl border border-white/10 overflow-hidden flex flex-col"
    >
      <div className={`h-28 bg-gradient-to-br ${LOADING_GRADIENTS[index]} animate-pulse`} />
      <div className="p-4 space-y-3 bg-[#0d0d1f] flex-1">
        <div className="h-5 bg-white/5 rounded-lg animate-pulse w-4/5" />
        <div className="h-3 bg-white/5 rounded-full animate-pulse" />
        <div className="h-3 bg-white/5 rounded-full animate-pulse w-5/6" />
        <div className="h-3 bg-white/5 rounded-full animate-pulse w-3/4" />
        <div className="h-10 bg-white/5 rounded-xl animate-pulse mt-2" />
      </div>
    </motion.div>
  );
}

// ── エラー状態 ─────────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center gap-4"
    >
      <div className="text-5xl">😅</div>
      <div>
        <p className="text-white font-bold mb-1">バトラーたちが迷子になりました</p>
        <p className="text-slate-500 text-sm">AIへの接続に失敗しました。もう一度呼んでみてください。</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white rounded-xl px-6 py-3 font-bold text-sm transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        もう一度試す
      </button>
    </motion.div>
  );
}

// ── バトラーカード ─────────────────────────────────────────────────────────────
interface BattlerCardProps {
  pick: BattlerPick;
  index: number;
  voted: string | null;
  onVote: (battlerId: string, keyword: string) => void;
}

function BattlerCard({ pick, index, voted, onVote }: BattlerCardProps) {
  const { battler, bookTitle, bookAuthor, hook, pitch, target, keyword } = pick;
  const isVoted = voted === battler.id;
  const otherVoted = voted !== null && !isVoted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40 }}
      animate={{
        opacity: otherVoted ? 0.35 : 1,
        y: 0,
        scale: isVoted ? 1.03 : otherVoted ? 0.97 : 1,
      }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
      className="relative rounded-2xl border flex flex-col overflow-hidden"
      style={{
        borderColor: isVoted ? `${battler.accentColor}60` : "rgba(255,255,255,0.08)",
        boxShadow: isVoted ? `0 0 40px 2px ${battler.accentColor}30` : undefined,
      }}
    >
      {/* ── グラデーションヘッダー ── */}
      <div
        className={`bg-gradient-to-br ${battler.gradientFrom} ${battler.gradientTo} p-4 relative`}
      >
        {/* 投票済みリボン */}
        {isVoted && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-3 right-3 flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-black text-white"
          >
            <Heart className="w-3 h-3 fill-white" /> 推し確定！
          </motion.div>
        )}

        {/* バトラー情報 */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-2xl">{battler.emoji}</span>
          <div>
            <div className="font-black text-white text-base leading-none">{battler.name}</div>
            <div className="text-white/55 text-[10px] mt-0.5 leading-none">{battler.tagline}</div>
          </div>
        </div>

        {/* 本タイトルパネル */}
        <div className="bg-black/30 backdrop-blur-sm rounded-xl px-3 py-2.5">
          <div className="text-white/40 text-[9px] font-bold tracking-widest mb-1">RECOMMENDS</div>
          <div className="text-white font-bold text-sm leading-snug">「{bookTitle}」</div>
          <div className="text-white/50 text-xs mt-0.5">{bookAuthor}</div>
        </div>
      </div>

      {/* ── カード本体 ── */}
      <div className="flex flex-col flex-1 bg-[#0d0d1f] px-4 py-4 gap-3">
        {/* フック（大きく、キャラカラー、最重要要素） */}
        <blockquote
          className="text-[17px] font-black leading-snug tracking-tight"
          style={{ color: battler.accentColor }}
        >
          「{sq(hook)}」
        </blockquote>

        {/* ピッチ */}
        <p className="text-slate-400 text-[13px] leading-relaxed flex-1">{pitch}</p>

        {/* キーワード + ターゲット */}
        <div className="space-y-1.5">
          <div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: `${battler.accentColor}20`,
                color: battler.accentColor,
                border: `1px solid ${battler.accentColor}35`,
              }}
            >
              #{keyword}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] leading-snug">👤 {target}</p>
        </div>

        {/* 投票ボタン */}
        <motion.button
          whileTap={!voted ? { scale: 0.96 } : {}}
          onClick={() => !voted && onVote(battler.id, keyword)}
          disabled={voted !== null}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
            isVoted
              ? "cursor-default"
              : voted !== null
              ? "opacity-25 cursor-not-allowed bg-white/5 text-white/30"
              : "text-white hover:brightness-110 active:brightness-90 cursor-pointer"
          }`}
          style={
            isVoted
              ? { background: `${battler.accentColor}30`, color: "white", border: `1px solid ${battler.accentColor}50` }
              : !voted
              ? { background: `linear-gradient(135deg, ${battler.accentColor}d0, ${battler.accentColor}80)` }
              : {}
          }
        >
          {isVoted ? (
            <>
              <Heart className="w-4 h-4 fill-white" />
              「{bookTitle}」を読みたい！
            </>
          ) : (
            <>
              <Heart className="w-4 h-4" />
              この本、気になる！
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── 投票完了バナー ─────────────────────────────────────────────────────────────
function VotedBanner({ pick }: { pick: BattlerPick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="mb-8"
    >
      <div
        className="relative rounded-2xl border px-5 py-4 flex items-center gap-4 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${pick.battler.accentColor}18, ${pick.battler.accentColor}08)`,
          borderColor: `${pick.battler.accentColor}40`,
        }}
      >
        {/* キラキラ装飾 */}
        <div className="absolute -top-6 -right-6 text-6xl opacity-10 select-none">
          {pick.battler.emoji}
        </div>

        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
          style={{ background: `${pick.battler.accentColor}25` }}
        >
          ✨
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="font-black text-sm leading-none mb-1"
            style={{ color: pick.battler.accentColor }}
          >
            {pick.battler.name}の推薦、採用！
          </div>
          <div className="text-white font-bold text-base leading-snug truncate">
            「{pick.bookTitle}」
          </div>
          <div className="text-slate-400 text-xs mt-0.5">
            ぜひ手に取ってみてください 📚
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── メインページ ───────────────────────────────────────────────────────────────
export default function Battler() {
  useSceneBGM("battler");
  const [picks, setPicks] = useState<BattlerPick[]>([]);
  const [voted, setVoted] = useState<string | null>(null);
  const [pref, setPref] = useState<BattlerPreference>(loadPreference);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 初回ローディングフラッシュ防止

  // 投票済みピック（バナー表示用）
  const votedPick = voted ? picks.find((p) => p.battler.id === voted) ?? null : null;

  const generateMutation = trpc.battler.generatePicks.useMutation({
    onSuccess: (data) => {
      setPicks(data);
      setVoted(null);
      setIsInitialLoad(false);
    },
    onError: (err) => {
      setIsInitialLoad(false);
      toast.error(err.message ?? "生成に失敗しました。もう一度お試しください。");
    },
  });

  // prefをrefで持つ（useEffectの依存を避けつつ最新値を使うため）
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const generate = (currentPref: BattlerPreference) => {
    const topBattlers = topBattlerIds(currentPref.battlerVotes);
    generateMutation.mutate({
      preferredBattlers: topBattlers,
      preferredKeywords: currentPref.keywords.slice(-10),
      sessionCount: currentPref.sessionCount,
    });
  };

  // 初回生成
  useEffect(() => {
    generate(prefRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVote = (battlerId: string, keyword: string) => {
    setVoted(battlerId);
    const newPref: BattlerPreference = {
      battlerVotes: {
        ...pref.battlerVotes,
        [battlerId]: (pref.battlerVotes[battlerId] ?? 0) + 1,
      },
      keywords: [...pref.keywords, keyword].slice(-30),
      sessionCount: pref.sessionCount,
    };
    setPref(newPref);
    savePreference(newPref);
  };

  const handleNext = () => {
    const newPref = { ...pref, sessionCount: pref.sessionCount + 1 };
    setPref(newPref);
    savePreference(newPref);
    generate(newPref);
  };

  const isLoading = isInitialLoad || generateMutation.isPending;
  const hasError = !isLoading && picks.length === 0;
  const totalVotes = Object.values(pref.battlerVotes).reduce((a, b) => a + b, 0);

  // ローディング中テキスト
  const loadingHint = pref.sessionCount === 0
    ? "4人のバトラーが本を選んでいます..."
    : "あなたの好みを踏まえて、次のセットを準備中...";

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">
      {/* 背景 */}
      <div className="fixed inset-0 pointer-events-none select-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      {/* ── ヘッダー ── */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-sm sticky top-0">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-black text-sm leading-none">バトラー推薦</div>
              <div className="text-[10px] text-slate-500 leading-none mt-0.5">Phase 3</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 学習カウンター */}
            <AnimatePresence>
              {totalVotes > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 border border-white/10 rounded-full px-3 py-1.5"
                >
                  <Zap className="w-3 h-3 text-pink-400" />
                  累計{totalVotes}票
                </motion.div>
              )}
            </AnimatePresence>
            <MuteButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 py-10">

        {/* ── ヒーローセクション ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-center mb-10"
        >
          {/* サブバッジ */}
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 rounded-full px-4 py-1.5 mb-5 text-sm text-pink-300">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {pref.sessionCount === 0
                ? "はじめまして！4人がそれぞれ1冊を本気でプレゼンします"
                : totalVotes >= 3
                ? `${totalVotes}票の記録をもとにAIが好みを反映しています`
                : `セット${pref.sessionCount + 1}回目 — 投票するとAIが学習します`}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black mb-3 leading-tight">
            どれが
            <span className="bg-gradient-to-r from-pink-400 via-rose-400 to-orange-400 bg-clip-text text-transparent">
              刺さる
            </span>
            ？
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            4人がそれぞれ違う本を語ります。<br className="hidden sm:block" />
            「読みたい！」と思った本に一票を。
          </p>
        </motion.div>

        {/* ── ローディングヒント ── */}
        <AnimatePresence>
          {isLoading && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-slate-500 text-sm mb-5"
            >
              {loadingHint}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ── カードグリッド ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {isLoading ? (
            [0, 1, 2, 3].map((i) => <LoadingCard key={i} index={i} />)
          ) : hasError ? (
            <ErrorState onRetry={() => generate(pref)} />
          ) : (
            <AnimatePresence mode="wait">
              {picks.map((pick, i) => (
                <BattlerCard
                  key={`${pick.battler.id}-${pick.bookTitle}-${pref.sessionCount}`}
                  pick={pick}
                  index={i}
                  voted={voted}
                  onVote={handleVote}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* ── 投票完了バナー ── */}
        <AnimatePresence>
          {votedPick && <VotedBanner pick={votedPick} />}
        </AnimatePresence>

        {/* ── 次のセットボタン ── */}
        <AnimatePresence>
          {!isLoading && !hasError && picks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                disabled={isLoading}
                className={`flex items-center gap-3 rounded-2xl px-8 py-4 font-black text-base transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                  voted
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25"
                    : "bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white"
                }`}
              >
                <RefreshCw
                  className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
                />
                {voted ? "次のセットへ進む →" : "別のセットを見る"}
              </motion.button>

              {!voted && (
                <p className="text-slate-600 text-xs">
                  投票しなくてもセットを更新できます
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 推しバトラーランキング（3票以上で表示） ── */}
        <AnimatePresence>
          {totalVotes >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-16 max-w-sm mx-auto"
            >
              <div className="text-center text-[11px] text-slate-500 font-bold tracking-widest uppercase mb-5">
                あなたの推しバトラー
              </div>
              <div className="space-y-3">
                {topBattlerIds(pref.battlerVotes)
                  .filter((id) => (pref.battlerVotes[id] ?? 0) > 0)
                  .map((id, rank) => {
                    const votes = pref.battlerVotes[id] ?? 0;
                    const maxVotes = Math.max(...Object.values(pref.battlerVotes));
                    const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                    const m = BATTLER_META[id];
                    if (!m) return null;
                    return (
                      <div key={id} className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-600 w-4">
                          {rank + 1}
                        </span>
                        <span className="text-base w-6 text-center">{m.emoji}</span>
                        <span className="text-xs text-slate-400 w-10 flex-shrink-0">{m.name}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${m.color}99, ${m.color})` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-5 text-right font-bold">{votes}</span>
                      </div>
                    );
                  })}
              </div>

              <p className="text-center text-[11px] text-slate-600 mt-5 leading-relaxed">
                投票を重ねるほど、
                <br />
                あなた好みのセットに近づきます 🎯
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── フッター ── */}
        <div className="mt-14 pb-6 text-center">
          <Link href="/">
            <button className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1.5 mx-auto transition-colors">
              <ArrowLeft className="w-3 h-3" />
              ホームに戻る
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
