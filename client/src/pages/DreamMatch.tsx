import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Shuffle, Swords, Trophy, BookOpen, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useSpeechSynthesis } from "@/hooks/useSpeech";
import { useBattleSound } from "@/hooks/useBattleSound";
import { useSceneBGM } from "@/hooks/useSceneBGM";
import { MuteButton } from "@/components/MuteButton";
import type { DreamCharacter, DreamBattle } from "@shared/types";

/** AIが返すテキストに含まれる先頭・末尾の鍵括弧を除去（二重括弧防止） */
function sq(text: string): string {
  return text.replace(/^[「『]/, "").replace(/[」』]$/, "");
}

// バトル開幕アナウンス（文豪の組み合わせに応じて変える）
function getBattleAnnounce(name1: string, name2: string): string {
  const patterns = [
    `${name1}、対、${name2}！今宵のバトル、開幕です！`,
    `${name1}と${name2}の激突！どちらの本があなたの心を動かすか！`,
    `いざ、開幕！${name1}対${name2}の頂上決戦です！`,
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

// ── キャラクター名言（クライアント拡張）──────────────────────────
const CHARACTER_QUOTES: Record<string, string> = {
  dazai:     "恥の多い生涯を送ってきましたが、この本は薦めずにいられません",
  soseki:    "余は、諸君にこの一冊を強く推薦する",
  kenji:     "銀河の彼方から見ても、この本は輝いている",
  akutagawa: "余計な言葉は要らない、ただ読め",
};

// ── キャラクター選択カード ─────────────────────────────────────
function CharacterCard({
  character,
  selected,
  selectable,
  onClick,
  slotNumber,
}: {
  character: DreamCharacter;
  selected: boolean;
  selectable: boolean;
  onClick: () => void;
  slotNumber?: number; // 1 or 2 when selected
}) {
  return (
    <motion.button
      whileHover={selectable || selected ? { scale: 1.03 } : {}}
      whileTap={selectable || selected ? { scale: 0.97 } : {}}
      onClick={onClick}
      disabled={!selectable && !selected}
      className={`relative p-4 rounded-2xl border-2 transition-all text-left w-full ${
        selected
          ? "border-violet-400 bg-violet-500/15 shadow-lg shadow-violet-500/25"
          : selectable
          ? "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
          : "border-white/5 bg-white/[0.02] opacity-35 cursor-not-allowed"
      }`}
    >
      {selected && slotNumber && (
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-violet-500 rounded-full flex items-center justify-center text-sm font-black text-white shadow-lg"
        >
          {slotNumber}
        </motion.div>
      )}
      <div className="text-3xl mb-2">{character.avatar}</div>
      <div className="font-black text-white text-base leading-tight">{character.name}</div>
      <div className="text-xs text-slate-500 mt-0.5">{character.era}</div>
      <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">
        「{CHARACTER_QUOTES[character.id] ?? character.style}」
      </p>
    </motion.button>
  );
}

// ── プレゼンカード ────────────────────────────────────────────
function PresentationCard({
  side,
  pres,
  voted,
  onVote,
  votedSide,
  votes1,
  votes2,
  isVoting,
  synth,
  speakingSide,
  setSpeakingSide,
}: {
  side: "1" | "2";
  pres: DreamBattle["side1"];
  voted: boolean;
  onVote: () => void;
  votedSide: "1" | "2" | null;
  votes1: number;
  votes2: number;
  isVoting: boolean;
  synth: ReturnType<typeof useSpeechSynthesis>;
  speakingSide: "1" | "2" | null;
  setSpeakingSide: (s: "1" | "2" | null) => void;
}) {
  const totalVotes = votes1 + votes2;
  const myVotes = side === "1" ? votes1 : votes2;
  const pct = totalVotes > 0 ? Math.round((myVotes / totalVotes) * 100) : 50;
  const isWinning = side === "1" ? votes1 > votes2 : votes2 > votes1;
  const isTied = votes1 === votes2 && totalVotes > 0;
  const isMyVote = votedSide === side;
  const isChamp = voted && isWinning && !isTied;

  const speakText = `${pres.character.name}が、「${pres.bookTitle}」を紹介します。${sq(pres.opening)}。${pres.body} ${sq(pres.closing)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: side === "1" ? 0.1 : 0.3 }}
      className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-500 ${
        isChamp
          ? "border-amber-400 shadow-2xl shadow-amber-500/20 scale-[1.01]"
          : isMyVote
          ? "border-violet-400 shadow-lg shadow-violet-500/20"
          : voted
          ? "border-white/10 opacity-80"
          : "border-white/10"
      }`}
    >
      {/* チャンプバッジ */}
      {isChamp && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-center"
        >
          <span className="text-white text-xs font-black tracking-widest">🏆 チャンプ本！</span>
        </motion.div>
      )}

      {/* キャラクターヘッダー */}
      <div
        className={`bg-gradient-to-br ${pres.character.gradientFrom} ${pres.character.gradientTo} p-5`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-3xl mb-1">{pres.character.avatar}</div>
            <div className="font-black text-white text-xl">{pres.character.name}</div>
            <div className="text-white/60 text-xs mt-0.5">{pres.character.era}</div>
          </div>
          <button
            onClick={() => {
              if (speakingSide === side) {
                synth.cancel();
                setSpeakingSide(null);
              } else {
                setSpeakingSide(side);
                synth.speak(speakText, "phase2");
              }
            }}
            className="flex items-center gap-1 text-white/50 hover:text-white transition-colors mt-1 text-xs"
            title="読み上げ"
          >
            {speakingSide === side ? (
              <><VolumeX className="w-4 h-4" /> 停止</>
            ) : (
              <><Volume2 className="w-4 h-4" /> 読む</>
            )}
          </button>
        </div>
        <div className="bg-black/20 backdrop-blur-sm rounded-xl px-4 py-2.5">
          <div className="text-xs text-white/50 mb-0.5">紹介する本</div>
          <div className="font-bold text-white text-base leading-tight">「{pres.bookTitle}」</div>
          <div className="text-white/60 text-xs mt-0.5">{pres.bookAuthor}</div>
        </div>
      </div>

      {/* プレゼン本文 */}
      <div className="flex-1 p-5 space-y-4 bg-slate-900/70">
        {/* 冒頭フック */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white/40 text-xs mb-1.5 font-bold tracking-wide">🎙 つかみ</p>
          <p className="text-white text-sm font-medium leading-relaxed italic">「{sq(pres.opening)}」</p>
        </div>

        {/* 本文 */}
        <p className="text-slate-300 text-sm leading-relaxed">{pres.body}</p>

        {/* 締め */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white/40 text-xs mb-1.5 font-bold tracking-wide">🎯 締め</p>
          <p className="text-white text-sm font-medium leading-relaxed italic">「{sq(pres.closing)}」</p>
        </div>

        {/* おすすめ対象 */}
        <div className="flex items-start gap-2 text-xs text-slate-400 bg-white/5 rounded-xl px-3 py-2.5">
          <BookOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: pres.character.accentColor }} />
          <span className="italic">{pres.recommendation}</span>
        </div>
      </div>

      {/* 投票エリア */}
      <div className="p-4 bg-slate-950/80 border-t border-white/5">
        {!voted ? (
          <Button
            className="w-full font-bold text-sm"
            onClick={onVote}
            disabled={isVoting}
            style={{
              background: `linear-gradient(135deg, ${pres.character.accentColor}40, ${pres.character.accentColor}70)`,
              border: `1px solid ${pres.character.accentColor}60`,
              color: "white",
            }}
          >
            {isVoting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> 投票中...</>
            ) : (
              <><Trophy className="w-4 h-4" />「{pres.bookTitle}」を読みたい！</>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={`font-bold ${isMyVote ? "text-white" : "text-slate-500"}`}>
                {isChamp ? "🏆 チャンプ本！" : isMyVote ? "✅ あなたの一票" : isTied ? "🤝 引き分け" : "惜しかった..."}
              </span>
              <span className="font-black text-base" style={{ color: pres.character.accentColor }}>
                {pct}%
                <span className="text-xs font-normal text-slate-500 ml-1">({myVotes}票)</span>
              </span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${pres.character.accentColor}99, ${pres.character.accentColor})` }}
              />
            </div>
            {isChamp && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center text-xs font-bold"
                style={{ color: pres.character.accentColor }}
              >
                ✨ 現在リード中
              </motion.p>
            )}
            {isTied && (
              <p className="text-center text-xs text-slate-400">同点！どちらが逆転する？</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── メインページ ──────────────────────────────────────────────
type Phase = "setup" | "generating" | "battle";

const GEN_MSGS = [
  "文豪たちが現代の本を吟味しています...",
  "太宰が自嘲しながらページをめくっています...",
  "漱石が眉をひそめて熟考中...",
  "賢治が銀河の彼方から本を眺めています...",
  "芥川がペンを構え、一刀両断の準備中...",
  "もうすぐ開幕。覚悟してください。",
];

export default function DreamMatch() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [battle, setBattle] = useState<DreamBattle | null>(null);
  const [voted, setVoted] = useState(false);
  const [votedSide, setVotedSide] = useState<"1" | "2" | null>(null);
  const [currentVotes, setCurrentVotes] = useState({ votes1: 0, votes2: 0 });
  const [genMsgIdx, setGenMsgIdx] = useState(0);
  const [selectedBooks, setSelectedBooks] = useState<[{ title: string; author: string }, { title: string; author: string }] | null>(null);

  const synth = useSpeechSynthesis();
  const [speakingSide, setSpeakingSide] = useState<"1" | "2" | null>(null);

  // 読み上げ終了時に speakingSide をリセット
  useEffect(() => {
    if (!synth.isSpeaking) setSpeakingSide(null);
  }, [synth.isSpeaking]);

  // 「バトル準備中」〜「プレゼン読み上げ」を通してバトルBGMを継続
  useBattleSound(phase === "generating" || phase === "battle");
  // セットアップ画面のみシーンBGM（バトル中はバトルサウンドが担う）
  useSceneBGM(phase === "setup" ? "dream-setup" : null);

  const charactersQuery = trpc.dreamMatch.getCharacters.useQuery();
  const booksQuery = trpc.dreamMatch.getBattleBooks.useQuery();
  const generateBattleMutation = trpc.dreamMatch.generateBattle.useMutation();
  const voteMutation = trpc.dreamMatch.vote.useMutation();

  // 生成中メッセージローテーション
  useEffect(() => {
    if (phase !== "generating") return;
    setGenMsgIdx(0);
    const id = setInterval(() => setGenMsgIdx((i) => (i + 1) % GEN_MSGS.length), 2500);
    return () => clearInterval(id);
  }, [phase]);

  // ランダムに本を2冊選ぶ
  const pickRandomBooks = () => {
    if (!booksQuery.data) return;
    const shuffled = [...booksQuery.data].sort(() => Math.random() - 0.5);
    setSelectedBooks([shuffled[0], shuffled[1]]);
  };

  useEffect(() => {
    if (booksQuery.data && !selectedBooks) pickRandomBooks();
  }, [booksQuery.data]);

  const toggleCharacter = (id: string) => {
    if (selectedChars.includes(id)) {
      setSelectedChars(selectedChars.filter((c) => c !== id));
    } else if (selectedChars.length < 2) {
      setSelectedChars([...selectedChars, id]);
    }
  };

  const randomizeChars = () => {
    const chars = charactersQuery.data ?? [];
    const shuffled = [...chars].sort(() => Math.random() - 0.5);
    setSelectedChars([shuffled[0].id, shuffled[1].id]);
    pickRandomBooks();
  };

  const battleId = selectedBooks && selectedChars.length === 2
    ? `${selectedChars[0]}_${selectedBooks[0].title}_${selectedChars[1]}_${selectedBooks[1].title}`
    : "";

  const handleStartBattle = async () => {
    if (!selectedBooks || selectedChars.length !== 2 || !battleId) return;
    setPhase("generating");

    // バトル開幕アナウンス
    const char1 = characters.find((c) => c.id === selectedChars[0]);
    const char2 = characters.find((c) => c.id === selectedChars[1]);
    if (char1 && char2) {
      synth.speak(getBattleAnnounce(char1.name, char2.name), "phase2");
    }

    try {
      const result = await generateBattleMutation.mutateAsync({
        book1: selectedBooks[0],
        book2: selectedBooks[1],
        character1Id: selectedChars[0],
        character2Id: selectedChars[1],
        battleId,
      });
      setBattle(result);
      setCurrentVotes({ votes1: result.votes1, votes2: result.votes2 });

      const storedVote = localStorage.getItem(`vote_${battleId}`);
      if (storedVote) {
        setVoted(true);
        setVotedSide(storedVote as "1" | "2");
      }
      setPhase("battle");
    } catch (e: any) {
      // tRPC はエラーを TRPCClientError でラップするので .message または .data.message を確認
      const raw: string = e?.data?.message ?? e?.message ?? "";
      // tRPC の "TRPCClientError: " プレフィックスを除去して読みやすくする
      const msg = raw.replace(/^TRPCClientError:\s*/i, "").trim();

      const userMsg =
        msg.includes("タイムアウト") || msg.includes("timeout")
          ? "生成に時間がかかりすぎました。もう一度お試しください。"
          : msg.includes("APIキー") || msg.includes("API_KEY") || msg.includes("authentication")
          ? "APIキーを確認してください。"
          : msg.includes("応答形式") || msg.includes("JSON") || msg.includes("Unexpected")
          ? "AIの応答形式が不正でした。もう一度お試しください。"
          : msg || "バトルの生成に失敗しました。もう一度お試しください。";

      console.error("[DreamMatch] handleStartBattle error:", raw);
      toast.error(userMsg);
      setPhase("setup");
    }
  };

  const handleVote = async (side: "1" | "2") => {
    if (!battle || voted) return;
    try {
      const result = await voteMutation.mutateAsync({ battleId: battle.id, side });
      setCurrentVotes(result);
      setVoted(true);
      setVotedSide(side);
      localStorage.setItem(`vote_${battle.id}`, side);
      const pickedTitle = side === "1" ? battle.side1.bookTitle : battle.side2.bookTitle;
      toast.success(`「${pickedTitle}」に一票！ 🏆`);
    } catch {
      toast.error("投票に失敗しました");
    }
  };

  const handleReset = () => {
    synth.cancel();
    setBattle(null);
    setVoted(false);
    setVotedSide(null);
    setSelectedChars([]);
    setSelectedBooks(null);
    setPhase("setup");
  };

  const characters = charactersQuery.data ?? [];

  // 生成中に表示する選択済みキャラ
  const selectedCharObjs = selectedChars
    .map((id) => characters.find((c) => c.id === id))
    .filter(Boolean) as DreamCharacter[];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* 背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-black text-white text-lg flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-400" /> ドリームマッチ
            </h1>
            <p className="text-xs text-slate-500">Phase 2 — 文豪AI vs 文豪AI</p>
          </div>
          {phase === "battle" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 新しいバトル
            </button>
          )}
          <MuteButton />
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">

          {/* ── セットアップ ─────────────────── */}
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {/* ヒーロー */}
              <div className="text-center space-y-3">
                <div className="text-5xl mb-2">⚔️</div>
                <h2 className="text-4xl font-black text-white leading-tight">
                  今宵の審判、
                  <span className="bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
                    あなたに委ねる
                  </span>
                </h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                  文豪AIが現代の本を独自の文体でプレゼン。<br />
                  あなたの一票が、チャンプ本を決める。
                </p>
              </div>

              {/* STEP 1: 文豪を選ぶ */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xs font-black">1</div>
                  <p className="text-sm font-bold text-slate-200">
                    対戦する文豪を2人選ぶ
                    {selectedChars.length > 0 && (
                      <span className="ml-2 text-amber-400">（{selectedChars.length}/2）</span>
                    )}
                  </p>
                  <button
                    onClick={randomizeChars}
                    className="ml-auto flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> おまかせ
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {characters.map((char) => (
                    <CharacterCard
                      key={char.id}
                      character={char}
                      selected={selectedChars.includes(char.id)}
                      selectable={selectedChars.length < 2 || selectedChars.includes(char.id)}
                      onClick={() => toggleCharacter(char.id)}
                      slotNumber={
                        selectedChars.includes(char.id)
                          ? selectedChars.indexOf(char.id) + 1
                          : undefined
                      }
                    />
                  ))}
                </div>

                {/* 選択中ミニプレビュー */}
                <AnimatePresence>
                  {selectedChars.length === 2 && selectedCharObjs.length === 2 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <span className="text-2xl">{selectedCharObjs[0].avatar}</span>
                      <span className="font-black text-sm text-white">{selectedCharObjs[0].name}</span>
                      <span className="text-slate-500 font-black text-sm px-2">⚔️ VS ⚔️</span>
                      <span className="font-black text-sm text-white">{selectedCharObjs[1].name}</span>
                      <span className="text-2xl">{selectedCharObjs[1].avatar}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* STEP 2: 対戦書籍 */}
              {selectedBooks && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-xs font-black">2</div>
                    <p className="text-sm font-bold text-slate-200">対戦書籍（毎回ランダム）</p>
                    <button
                      onClick={pickRandomBooks}
                      className="ml-auto flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <Shuffle className="w-3.5 h-3.5" /> シャッフル
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {selectedBooks.map((book, i) => (
                      <motion.div
                        key={book.title}
                        initial={{ opacity: 0, x: i === 0 ? -10 : 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0 ${
                          i === 0
                            ? "bg-gradient-to-br from-rose-500/40 to-rose-700/40"
                            : "bg-gradient-to-br from-amber-500/40 to-amber-700/40"
                        }`}>
                          {i === 0 ? "A" : "B"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">「{book.title}」</p>
                          <p className="text-xs text-slate-500">{book.author}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* バトル開始ボタン */}
              <div className="space-y-2">
                <Button
                  size="xl"
                  className="w-full text-base font-black tracking-wide"
                  disabled={selectedChars.length !== 2 || !selectedBooks}
                  onClick={handleStartBattle}
                >
                  <Swords className="w-5 h-5" />
                  {selectedChars.length !== 2 ? "文豪を2人選んでください" : "いざ、開幕！"}
                </Button>
                {selectedChars.length === 2 && (
                  <p className="text-center text-xs text-slate-600">
                    AI生成には10〜20秒かかります
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── 生成中 ───────────────────────── */}
          {phase === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              {/* 選択キャラのVS演出 */}
              {selectedCharObjs.length === 2 ? (
                <div className="flex items-center justify-center gap-6 mb-10">
                  <motion.div
                    animate={{ x: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="text-center"
                  >
                    <div className="text-5xl mb-2">{selectedCharObjs[0].avatar}</div>
                    <p className="text-xs font-bold text-slate-400">{selectedCharObjs[0].name}</p>
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-3xl"
                  >
                    ⚔️
                  </motion.div>
                  <motion.div
                    animate={{ x: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="text-center"
                  >
                    <div className="text-5xl mb-2">{selectedCharObjs[1].avatar}</div>
                    <p className="text-xs font-bold text-slate-400">{selectedCharObjs[1].name}</p>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="text-6xl mb-10 inline-block"
                >
                  ⚔️
                </motion.div>
              )}

              <h2 className="text-2xl font-black text-white mb-3">バトル準備中</h2>
              <AnimatePresence mode="wait">
                <motion.p
                  key={genMsgIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-slate-400 text-sm"
                >
                  {GEN_MSGS[genMsgIdx]}
                </motion.p>
              </AnimatePresence>
              <div className="flex justify-center gap-2 mt-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.4 }}
                    className="w-2 h-2 rounded-full bg-amber-400"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── バトル ───────────────────────── */}
          {phase === "battle" && battle && (
            <motion.div
              key="battle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* VS ヘッダー */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 sm:gap-5">
                  {/* 左キャラ */}
                  <div className="text-right flex-1 min-w-0">
                    <div className="text-2xl sm:text-3xl">{battle.side1.character.avatar}</div>
                    <p
                      className="font-black text-sm sm:text-base truncate"
                      style={{ color: battle.side1.character.accentColor }}
                    >
                      {battle.side1.character.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">「{battle.side1.bookTitle}」</p>
                  </div>

                  {/* VS */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-400">VS</span>
                  </div>

                  {/* 右キャラ */}
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-2xl sm:text-3xl">{battle.side2.character.avatar}</div>
                    <p
                      className="font-black text-sm sm:text-base truncate"
                      style={{ color: battle.side2.character.accentColor }}
                    >
                      {battle.side2.character.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">「{battle.side2.bookTitle}」</p>
                  </div>
                </div>

                {/* 指示 or 結果 */}
                <AnimatePresence mode="wait">
                  {!voted ? (
                    <motion.p
                      key="instruction"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-slate-400"
                    >
                      プレゼンを読んで、<span className="text-white font-bold">読みたくなった本</span>に投票してください
                    </motion.p>
                  ) : (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 text-xs font-bold">
                        投票済み — 累計 {currentVotes.votes1 + currentVotes.votes2} 票
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* バトルカード */}
              <div className="grid md:grid-cols-2 gap-6">
                <PresentationCard
                  side="1"
                  pres={battle.side1}
                  voted={voted}
                  onVote={() => handleVote("1")}
                  votedSide={votedSide}
                  votes1={currentVotes.votes1}
                  votes2={currentVotes.votes2}
                  isVoting={voteMutation.isPending}
                  synth={synth}
                  speakingSide={speakingSide}
                  setSpeakingSide={setSpeakingSide}
                />
                <PresentationCard
                  side="2"
                  pres={battle.side2}
                  voted={voted}
                  onVote={() => handleVote("2")}
                  votedSide={votedSide}
                  votes1={currentVotes.votes1}
                  votes2={currentVotes.votes2}
                  isVoting={voteMutation.isPending}
                  synth={synth}
                  speakingSide={speakingSide}
                  setSpeakingSide={setSpeakingSide}
                />
              </div>

              {/* 投票後の再挑戦 */}
              {voted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center space-y-3 pt-2"
                >
                  <p className="text-xs text-slate-500">
                    気になった本はぜひ手に取ってみてください 📚
                  </p>
                  <Button variant="secondary" onClick={handleReset}>
                    <Swords className="w-4 h-4" /> 別の組み合わせで再戦
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
