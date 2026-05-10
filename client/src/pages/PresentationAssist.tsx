import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Trash2, Wand2, ChevronLeft, BookOpen,
  Clock, Lightbulb, Quote, Copy, Check, ArrowRight, RefreshCw
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BookInfo, PresentationStructure } from "@shared/types";
import { useSceneBGM } from "@/hooks/useSceneBGM";
import { MuteButton } from "@/components/MuteButton";

/** AIが返すテキストに含まれる先頭・末尾の鍵括弧を除去（二重括弧防止） */
function sq(text: string): string {
  return text.replace(/^[「『]/, "").replace(/[」』]$/, "");
}

const styleConfig = {
  logical: { color: "from-blue-500 to-cyan-500", badge: "blue" as const, icon: "🧠" },
  story: { color: "from-violet-500 to-purple-500", badge: "default" as const, icon: "📖" },
  emotional: { color: "from-pink-500 to-rose-500", badge: "red" as const, icon: "💖" },
};

// ── クイック選書リスト ────────────────────────────────────────────────────────
const QUICK_BOOKS: { title: string; author: string; genre: string }[] = [
  // 小説・青春
  { title: "本日はお日柄もよく",       author: "原田マハ",             genre: "小説" },
  { title: "運転者",                   author: "喜多川泰",             genre: "小説" },
  { title: "君の膵臓をたべたい",       author: "住野よる",             genre: "小説" },
  { title: "かがみの孤城",             author: "辻村深月",             genre: "小説" },
  { title: "流浪の月",                 author: "凪良ゆう",             genre: "小説" },
  { title: "コンビニ人間",             author: "村田沙耶香",           genre: "小説" },
  { title: "夜は短し歩けよ乙女",       author: "森見登美彦",           genre: "小説" },
  // 思考・教養・アート
  { title: "13歳からのアート思考",     author: "末永幸歩",             genre: "教養" },
  { title: "孤独力",                   author: "齋藤孝",               genre: "教養" },
  { title: "嫌われる勇気",             author: "岸見一郎・古賀史健",   genre: "教養" },
  { title: "ファクトフルネス",         author: "ハンス・ロスリング",   genre: "教養" },
  { title: "サピエンス全史",           author: "ユヴァル・ノア・ハラリ", genre: "教養" },
  // 詩・エッセイ
  { title: "あなたのための短歌集",     author: "木下龍也",             genre: "詩歌" },
  { title: "星の王子さま",             author: "サン=テグジュペリ",    genre: "詩歌" },
];

const GENRE_COLORS: Record<string, string> = {
  小説: "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
  教養: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20",
  詩歌: "border-pink-500/30 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20",
};

function BookSearchStep({
  onSelect,
}: {
  onSelect: (book: BookInfo) => void;
}) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");

  const searchQuery = trpc.books.search.useQuery(
    { query },
    { enabled: searched && query.length > 0 }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { setSearched(true); setManualMode(false); }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    onSelect({
      id: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      authors: manualAuthor.trim() ? [manualAuthor.trim()] : ["不明"],
      description: "",
    });
  };

  const noResults = searched && searchQuery.data?.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white mb-2">どの本を語る？</h2>
        <p className="text-slate-400">タイトルや著者名で検索、見つからなければ直接入力もOK</p>
      </div>

      {!manualMode ? (
        <>
          {/* ── クイック選書 ── */}
          {!searched && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">よく語られる本</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_BOOKS.map((book) => (
                  <button
                    key={book.title}
                    onClick={() =>
                      onSelect({
                        id: `preset-${book.title}`,
                        title: book.title,
                        authors: [book.author],
                        description: "",
                      })
                    }
                    className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all ${GENRE_COLORS[book.genre]}`}
                  >
                    <span className="text-xs font-black leading-tight">{book.title}</span>
                    <span className="text-[10px] opacity-60 mt-0.5">{book.author}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs text-slate-600 mb-2">上にない本は検索で探せます</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className="flex gap-3">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearched(false); }}
              placeholder="「嫌われる勇気」「流浪の月」など..."
              className="flex-1"
            />
            <Button type="submit" disabled={!query.trim()}>
              <Search className="w-4 h-4" />
              検索
            </Button>
          </form>

          {searchQuery.isLoading && (
            <div className="text-center py-8 text-slate-400">検索中...</div>
          )}

          {searchQuery.data && searchQuery.data.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {searchQuery.data.map((book) => (
                <button
                  key={book.id}
                  onClick={() => onSelect(book)}
                  className="flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/40 transition-all text-left group"
                >
                  {book.thumbnail ? (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-violet-300 transition-colors">
                      {book.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{book.authors.join(", ")}</p>
                    {book.publishedDate && (
                      <p className="text-xs text-slate-600">{book.publishedDate.slice(0, 4)}年</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {noResults && (
            <div className="text-center py-6 space-y-3">
              <p className="text-slate-500">「{query}」は見つかりませんでした</p>
              <button
                onClick={() => { setManualTitle(query); setManualMode(true); }}
                className="text-violet-400 hover:text-violet-300 text-sm underline underline-offset-4 transition-colors"
              >
                タイトルを直接入力する →
              </button>
            </div>
          )}

          {/* 常に表示する手動入力リンク */}
          {!noResults && (
            <div className="text-center">
              <button
                onClick={() => setManualMode(true)}
                className="text-slate-500 hover:text-slate-300 text-sm underline underline-offset-4 transition-colors"
              >
                📝 タイトルを直接打ち込む
              </button>
            </div>
          )}
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setManualMode(false)}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> 検索に戻る
            </button>
          </div>

          <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5">
            <p className="text-sm text-violet-300 mb-4">📚 タイトルを直接入力してください。著者名はわかる範囲でOKです</p>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">本のタイトル *</label>
                <Input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="例：13歳からのアート思考"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">著者名（任意）</label>
                <Input
                  value={manualAuthor}
                  onChange={(e) => setManualAuthor(e.target.value)}
                  placeholder="例：末永幸歩"
                />
              </div>
              <Button
                type="submit"
                disabled={!manualTitle.trim()}
                className="w-full"
              >
                <ArrowRight className="w-4 h-4" />
                この本でプレゼン構成を作る
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function KeyPointsStep({
  book,
  onBack,
  onNext,
}: {
  book: BookInfo;
  onBack: () => void;
  onNext: (points: string[], duration: number) => void;
}) {
  const [points, setPoints] = useState<string[]>(["", "", ""]);
  const [duration, setDuration] = useState(3);

  const addPoint = () => setPoints([...points, ""]);
  const removePoint = (i: number) => setPoints(points.filter((_, idx) => idx !== i));
  const updatePoint = (i: number, val: string) => {
    const next = [...points];
    next[i] = val;
    setPoints(next);
  };

  const validPoints = points.filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
        <ChevronLeft className="w-4 h-4" /> 本を選び直す
      </button>

      {/* 選択中の本 */}
      <div className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        {book.thumbnail ? (
          <img src={book.thumbnail} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-10 h-14 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-slate-500" />
          </div>
        )}
        <div>
          <p className="font-bold text-white text-sm">{book.title}</p>
          <p className="text-xs text-slate-500">{book.authors.join(", ")}</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white mb-2">あなたの心を動かした瞬間は？</h2>
        <p className="text-slate-400 text-sm">
          心が震えたシーン・台詞・考え方を思い出して書いてみて。AIへの「燃料」になります（1〜10個）
        </p>
      </div>

      <div className="space-y-3">
        {points.map((point, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-10 flex items-center justify-center text-slate-500 text-sm font-bold">
              {i + 1}
            </div>
            <Input
              value={point}
              onChange={(e) => updatePoint(i, e.target.value)}
              placeholder={[
                "例：読んでいて思わず声が出た衝撃のシーン",
                "例：この一言が頭から何日も離れなかった",
                "例：涙が止まらなかったラストの展開",
                "例：現実で実践したくなった考え方",
                "例：主人公の選択に思わず共感してしまった",
                "例：読み終わった後に世界の見え方が変わった",
              ][i % 6]}
            />
            {points.length > 1 && (
              <button
                onClick={() => removePoint(i)}
                className="text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addPoint}
        disabled={points.length >= 10}
        className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40"
      >
        <Plus className="w-4 h-4" /> もっと語りたい！
      </button>

      {/* 発表時間 */}
      <div>
        <label className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> 発表時間
        </label>
        <div className="flex gap-3 flex-wrap">
          {[2, 3, 5].map((min) => (
            <button
              key={min}
              onClick={() => setDuration(min)}
              className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                duration === min
                  ? "bg-violet-500/20 border-violet-500 text-violet-300"
                  : "border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {min}分
            </button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={validPoints.length === 0}
        onClick={() => onNext(validPoints, duration)}
      >
        <Wand2 className="w-5 h-5" />
        AIで構成案を生成する
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function StructuresStep({
  structures,
  book,
  onBack,
  onGoQA,
}: {
  structures: PresentationStructure[];
  book: BookInfo;
  onBack: () => void;
  onGoQA: (structureText: string) => void;
}) {
  const [activeStyle, setActiveStyle] = useState<string>(structures[0]?.style);
  const [copied, setCopied] = useState(false);

  const active = structures.find((s) => s.style === activeStyle);

  const copyToClipboard = async () => {
    if (!active) return;
    const text = [
      `【${active.styleLabel}】 - ${book.title}`,
      "",
      `冒頭: ${active.openingHook}`,
      "",
      ...active.sections.map((s) => `■ ${s.title}（${s.duration}）\n${s.content}\n💡 ${s.tips}`),
      "",
      `締め: ${active.closingLine}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
        <ChevronLeft className="w-4 h-4" /> 感動ポイントを編集
      </button>

      <div>
        <h2 className="text-2xl font-black text-white mb-1">🎯 作戦会議、完了！</h2>
        <p className="text-slate-400 text-sm">3パターンの「勝ち筋」を用意しました。どれで攻める？</p>
      </div>

      {/* スタイル選択 */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {structures.map((s) => {
          const cfg = styleConfig[s.style];
          return (
            <button
              key={s.style}
              onClick={() => setActiveStyle(s.style)}
              className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all text-left min-w-[140px] ${
                activeStyle === s.style
                  ? `bg-gradient-to-br ${cfg.color} border-transparent text-white shadow-lg`
                  : "border-white/10 text-slate-400 hover:border-white/20 bg-white/5"
              }`}
            >
              <div className="text-xl mb-1">{cfg.icon}</div>
              <div className="font-bold text-sm">{s.styleLabel}</div>
              <div className="text-xs opacity-70">{s.styleDescription}</div>
            </button>
          );
        })}
      </div>

      {active && (
        <AnimatePresence mode="wait">
          <motion.div
            key={active.style}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* 冒頭フック */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-2">
                <Quote className="w-3 h-3" /> 冒頭フック
              </div>
              <p className="text-white font-medium">「{sq(active.openingHook)}」</p>
            </div>

            {/* セクション */}
            <div className="space-y-3">
              {active.sections.map((section, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{section.title}</span>
                    <Badge variant="slate">
                      <Clock className="w-3 h-3" />
                      {section.duration}
                    </Badge>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-3">{section.content}</p>
                  <div className="flex items-start gap-2 text-xs text-emerald-400">
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{section.tips}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 締め */}
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center gap-2 text-violet-400 text-xs font-bold mb-2">
                <Quote className="w-3 h-3" /> 締めの一言
              </div>
              <p className="text-white font-medium">「{sq(active.closingLine)}」</p>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* アクション */}
      <div className="flex gap-3">
        <Button variant="ghost" size="md" onClick={copyToClipboard} className="flex-1 border border-white/10">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "コピーしました" : "テキストをコピー"}
        </Button>
        <Button size="md" className="flex-1" onClick={() => {
          if (!active) return;
          const text = [
            `【冒頭】${active.openingHook}`,
            ...active.sections.map((s) => `【${s.title}】${s.content}`),
            `【締め】${active.closingLine}`,
          ].join("\n\n");
          onGoQA(text);
        }}>
          🎤 この構成でQ&A練習へ <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const LOADING_MSGS = [
  "Claude先生が3パターンの作戦を立案中...",
  "論理派・ストーリー派・感情派、全員集合！",
  "あなたの感動ポイントを徹底解剖しています...",
  "ビブリオバトル優勝パターンを分析中...",
  "冒頭の一言が決め手です。考案中...",
  "もう少しだけ待って、いい構成になります！",
];

type Step = "search" | "keypoints" | "structures";

export default function PresentationAssist() {
  useSceneBGM("assist");
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("search");
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null);
  const [structures, setStructures] = useState<PresentationStructure[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // ローディング中メッセージをローテーション
  useEffect(() => {
    if (!isGenerating) return;
    setLoadingMsgIdx(0);
    const id = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 2200);
    return () => clearInterval(id);
  }, [isGenerating]);

  const generateMutation = trpc.presentation.generateStructures.useMutation();

  const handleBookSelect = (book: BookInfo) => {
    setSelectedBook(book);
    setStep("keypoints");
  };

  const handleGenerateStructures = async (keyPoints: string[], duration: number) => {
    if (!selectedBook) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateMutation.mutateAsync({
        bookTitle: selectedBook.title,
        bookAuthor: selectedBook.authors[0],
        keyPoints,
        durationMinutes: duration,
      });
      setStructures(result);
      setStep("structures");
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* 背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-white">プレゼン構成アシスト</h1>
            <p className="text-xs text-slate-500">Phase 1 - 壁打ちモード</p>
          </div>
          <MuteButton />
        </div>
        {/* ステッパー */}
        <div className="max-w-3xl mx-auto px-6 pb-3">
          <div className="flex gap-1">
            {(["search", "keypoints", "structures"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  ["search", "keypoints", "structures"].indexOf(step) >= i
                    ? "bg-violet-500"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        {isGenerating ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Wand2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">作戦を立案中...</h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingMsgIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-slate-400 text-sm"
              >
                {LOADING_MSGS[loadingMsgIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 flex flex-col items-center gap-4"
          >
            <div className="text-5xl">😓</div>
            <div>
              <p className="text-white font-bold mb-1">構成の生成に失敗しました</p>
              <p className="text-slate-500 text-sm">{error}</p>
            </div>
            <Button onClick={() => setError(null)}>
              <RefreshCw className="w-4 h-4" /> もう一度試す
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {step === "search" && <BookSearchStep onSelect={handleBookSelect} />}
              {step === "keypoints" && selectedBook && (
                <KeyPointsStep
                  book={selectedBook}
                  onBack={() => setStep("search")}
                  onNext={handleGenerateStructures}
                />
              )}
              {step === "structures" && selectedBook && structures.length > 0 && (
                <StructuresStep
                  structures={structures}
                  book={selectedBook}
                  onBack={() => setStep("keypoints")}
                  onGoQA={(structureText) => {
                    // 構成内容を sessionStorage に保存して MockQA で使う
                    sessionStorage.setItem("qaPresentation", structureText);
                    navigate(`/qa?book=${encodeURIComponent(selectedBook.title)}`);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
