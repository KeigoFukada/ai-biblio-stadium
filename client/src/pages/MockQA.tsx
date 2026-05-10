import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Square, Send, Volume2, VolumeX, ChevronLeft,
  MessageCircle, Star, Zap, RefreshCw, ChevronRight, BookOpen
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/useSpeech";
import type { QAQuestion, QAFeedback } from "@shared/types";

/** AIが返すテキストに含まれる先頭・末尾の鍵括弧を除去（二重括弧防止） */
function sq(text: string): string {
  return text.replace(/^[「『]/, "").replace(/[」』]$/, "");
}
import { useSceneBGM } from "@/hooks/useSceneBGM";
import { MuteButton } from "@/components/MuteButton";

const questionTypeConfig = {
  sharp: { label: "鋭い質問", badge: "red" as const, icon: "⚡" },
  curious: { label: "素朴な疑問", badge: "blue" as const, icon: "🤔" },
  clarification: { label: "確認質問", badge: "slate" as const, icon: "🔍" },
  opinion: { label: "意見を求める", badge: "default" as const, icon: "💭" },
};

const difficultyConfig = {
  easy: { label: "易", color: "text-emerald-400" },
  medium: { label: "中", color: "text-amber-400" },
  hard: { label: "難", color: "text-red-400" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text x="50" y="50" textAnchor="middle" dy="0.35em" fontSize="20" fontWeight="bold" fill="white">
        {score}
      </text>
    </svg>
  );
}

const GEN_LOADING_MSGS = [
  "意地悪な審査員たちが席に着きました...",
  "読書家5人が、あなたのプレゼンを聞いています...",
  "「その本、本当に面白いの？」と疑い始めています...",
  "鋭い質問を練っています...",
  "あなたの隙を探しています... 覚悟して！",
];

const SCORE_REACTION: { min: number; emoji: string; label: string }[] = [
  { min: 90, emoji: "🏆", label: "神回答！完璧です" },
  { min: 80, emoji: "⭐", label: "素晴らしい回答！" },
  { min: 60, emoji: "👍", label: "なかなかいい！" },
  { min: 40, emoji: "🔥", label: "あともう一歩！" },
  { min: 0,  emoji: "💪", label: "練習あるのみ！" },
];

function getScoreReaction(score: number) {
  return SCORE_REACTION.find((r) => score >= r.min) ?? SCORE_REACTION[SCORE_REACTION.length - 1];
}

export default function MockQA() {
  useSceneBGM("qa");
  const search = useSearch();
  const params = new URLSearchParams(search);
  const bookFromParam = params.get("book") ?? "";

  const [bookTitle, setBookTitle] = useState(bookFromParam);

  // Phase1 の構成アシストから引き継いだプレゼン内容を使う
  // lazy initializer で StrictMode の二重呼び出しを防ぐ
  const [presentation, setPresentation] = useState(() => {
    const saved = sessionStorage.getItem("qaPresentation") ?? "";
    if (saved) sessionStorage.removeItem("qaPresentation");
    return saved;
  });
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [activeQIndex, setActiveQIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<QAFeedback | null>(null);
  const [answeredMap, setAnsweredMap] = useState<Record<string, QAFeedback>>({});
  const [phase, setPhase] = useState<"input" | "questions" | "answering" | "feedback">("input");
  const [genMsgIdx, setGenMsgIdx] = useState(0);

  const speech = useSpeechRecognition();
  const synth = useSpeechSynthesis();

  const generateQsMutation = trpc.presentation.generateQuestions.useMutation();
  const evalMutation = trpc.presentation.evaluateAnswer.useMutation();

  // 質問生成中のメッセージローテーション
  useEffect(() => {
    if (!generateQsMutation.isPending) return;
    setGenMsgIdx(0);
    const id = setInterval(() => setGenMsgIdx((i) => (i + 1) % GEN_LOADING_MSGS.length), 2000);
    return () => clearInterval(id);
  }, [generateQsMutation.isPending]);

  // 音声入力をtextareaに反映
  useEffect(() => {
    if (speech.transcript && phase === "input") {
      setPresentation(speech.transcript);
    }
    if (speech.transcript && phase === "answering") {
      setAnswer(speech.transcript);
    }
  }, [speech.transcript, phase]);

  const handleGenerateQuestions = async () => {
    if (!presentation.trim()) return;
    try {
      const qs = await generateQsMutation.mutateAsync({
        bookTitle: bookTitle || "（タイトル未入力）",
        presentationText: presentation,
        questionCount: 5,
      });
      setQuestions(qs);
      setActiveQIndex(0);
      setPhase("questions");
    } catch (e: any) {
      toast.error(e.message ?? "質問の生成に失敗しました。もう一度お試しください。");
    }
  };

  const handleSelectQuestion = (index: number) => {
    setActiveQIndex(index);
    setAnswer("");
    setFeedback(null);
    speech.reset();
    setPhase("answering");
    // 質問を読み上げ
    synth.speak(questions[index].question, "phase1");
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    const q = questions[activeQIndex];
    try {
      const fb = await evalMutation.mutateAsync({
        question: q.question,
        answer,
        bookTitle: bookTitle || "（タイトル未入力）",
        presentationText: presentation,
      });
      setFeedback(fb);
      setAnsweredMap((prev) => ({ ...prev, [q.id]: fb }));
      setPhase("feedback");
    } catch (e: any) {
      toast.error(e.message ?? "評価に失敗しました。もう一度お試しください。");
    }
  };

  const currentQuestion = questions[activeQIndex];
  const answeredCount = Object.keys(answeredMap).length;
  const avgScore =
    answeredCount > 0
      ? Math.round(Object.values(answeredMap).reduce((s, f) => s + f.score, 0) / answeredCount)
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/assist">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-white">模擬Q&Aモード</h1>
            <p className="text-xs text-slate-500">仮想オーディエンスが質問します</p>
          </div>
          {answeredCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-bold">{avgScore}点</span>
              <span className="text-slate-500">({answeredCount}問回答)</span>
            </div>
          )}
          <MuteButton />
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* === PHASE: input === */}
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-black text-white mb-2">プレゼン、聞かせて</h2>
                <p className="text-slate-400 text-sm">
                  本番のつもりで2〜3分間のプレゼン内容を入力（音声入力も可）。送信後、AIが審査員モードに切り替わります。
                </p>
              </div>

              {/* 本タイトル */}
              {!bookFromParam && (
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> 本のタイトル
                  </label>
                  <input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="例：蜘蛛の糸"
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}

              {bookFromParam && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
                  <BookOpen className="w-4 h-4 text-violet-400" />
                  <span className="text-slate-300">{bookFromParam}</span>
                </div>
              )}

              {/* プレゼン入力エリア */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">プレゼン内容</label>
                  {speech.isSupported && (
                    <button
                      onClick={speech.isListening ? speech.stop : speech.start}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                        speech.isListening
                          ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                          : "border-white/20 text-slate-400 hover:border-white/40"
                      }`}
                    >
                      {speech.isListening ? (
                        <><Square className="w-3 h-3" /> 録音停止</>
                      ) : (
                        <><Mic className="w-3 h-3" /> 音声入力</>
                      )}
                    </button>
                  )}
                </div>
                <Textarea
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  placeholder={"この本を選んだ理由、どんな話か、どこが刺さったか、誰に読んでほしいか…\n思い出したままで大丈夫です。箇条書きでもOK！"}
                  rows={8}
                />
                <p className="text-xs text-slate-600 mt-1 text-right">{presentation.length}文字</p>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={!presentation.trim() || generateQsMutation.isPending}
                onClick={handleGenerateQuestions}
              >
                {generateQsMutation.isPending ? (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={genMsgIdx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
                      {GEN_LOADING_MSGS[genMsgIdx]}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" /> 審査員モードに切り替える
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* === PHASE: questions === */}
          {phase === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white mb-1">さあ、来い。</h2>
                  <p className="text-slate-400 text-sm">
                    答えたい質問から攻めてOK（{answeredCount}/{questions.length}問回答済）
                  </p>
                </div>
                <button
                  onClick={() => setPhase("input")}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  最初から
                </button>
              </div>

              <div className="space-y-3">
                {questions.map((q, i) => {
                  const cfg = questionTypeConfig[q.type];
                  const diff = difficultyConfig[q.difficulty];
                  const isAnswered = !!answeredMap[q.id];

                  return (
                    <motion.button
                      key={q.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => handleSelectQuestion(i)}
                      className={`w-full text-left p-4 rounded-xl border transition-all group ${
                        isAnswered
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">{cfg.icon}</span>
                            <Badge variant={cfg.badge}>{cfg.label}</Badge>
                            <span className={`text-xs font-bold ${diff.color}`}>
                              難易度：{diff.label}
                            </span>
                            {isAnswered && (
                              <Badge variant="green">
                                {answeredMap[q.id].score}点
                              </Badge>
                            )}
                          </div>
                          <p className="text-white text-sm leading-relaxed">{q.question}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white flex-shrink-0 mt-1 transition-colors" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {answeredCount === questions.length && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-violet-500/20"
                >
                  <div className="text-5xl mb-3">
                    {avgScore >= 80 ? "🏆" : avgScore >= 60 ? "🌟" : "🔥"}
                  </div>
                  <p className="text-white font-bold text-xl mb-1">
                    {avgScore >= 80 ? "完璧！チャンプ本、狙えます" : avgScore >= 60 ? "いい練習になりました！" : "悔しいでしょ？もう一回！"}
                  </p>
                  <p className="text-slate-400 text-sm mb-2">全 {questions.length} 問クリア</p>
                  <p className="text-amber-400 font-black text-3xl mb-4">{avgScore}<span className="text-base font-normal text-slate-400">点</span></p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={async () => {
                        try {
                          const qs = await generateQsMutation.mutateAsync({
                            bookTitle: bookTitle || "（タイトル未入力）",
                            presentationText: presentation,
                            questionCount: 5,
                          });
                          setQuestions(qs);
                          setActiveQIndex(0);
                          setAnsweredMap({});
                          setPhase("questions");
                        } catch (e: any) {
                          toast.error(e.message ?? "質問の生成に失敗しました。");
                        }
                      }}
                      disabled={generateQsMutation.isPending}
                    >
                      {generateQsMutation.isPending
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> 生成中...</>
                        : <><Zap className="w-4 h-4" /> 新しい質問をさらに5問</>}
                    </Button>
                    <Button onClick={() => setPhase("input")} variant="outline">
                      別のプレゼンでもう一戦
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* === PHASE: answering === */}
          {(phase === "answering" || phase === "feedback") && currentQuestion && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setPhase("questions"); synth.cancel(); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> 質問一覧へ
                </button>
                <span className="text-xs text-slate-500">
                  {activeQIndex + 1} / {questions.length}
                </span>
              </div>

              {/* 質問カード */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-base">
                    {questionTypeConfig[currentQuestion.type].icon}
                  </div>
                  <span className="text-sm font-bold text-slate-300">仮想オーディエンス</span>
                  <button
                    onClick={() => synth.isSpeaking ? synth.cancel() : synth.speak(currentQuestion.question, "phase1")}
                    className="ml-auto text-slate-500 hover:text-violet-400 transition-colors"
                    title="質問を読み上げ"
                  >
                    {synth.isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-white font-medium text-lg leading-relaxed">
                  {currentQuestion.question}
                </p>
              </div>

              {/* 回答エリア */}
              {phase === "answering" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-300">あなたの回答</label>
                    {speech.isSupported && (
                      <button
                        onClick={speech.isListening ? speech.stop : () => { speech.reset(); speech.start(); }}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                          speech.isListening
                            ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                            : "border-white/20 text-slate-400 hover:border-white/40"
                        }`}
                      >
                        {speech.isListening ? (
                          <><Square className="w-3 h-3" /> 停止</>
                        ) : (
                          <><Mic className="w-3 h-3" /> 音声で回答</>
                        )}
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="この質問への回答を入力してください..."
                    rows={5}
                  />
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!answer.trim() || evalMutation.isPending}
                    onClick={handleSubmitAnswer}
                  >
                    {evalMutation.isPending ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> 評価中...</>
                    ) : (
                      <><Send className="w-5 h-5" /> 回答を送信してフィードバックを受け取る</>
                    )}
                  </Button>
                </div>
              )}

              {/* フィードバック */}
              {phase === "feedback" && feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* スコア */}
                  <div className="flex items-center gap-6 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <ScoreRing score={feedback.score} />
                    <div>
                      <p className="text-slate-400 text-sm mb-1">回答スコア</p>
                      <p className="text-3xl font-black text-white">{feedback.score}<span className="text-lg text-slate-400">/100</span></p>
                      <p className="text-base font-bold mt-1" style={{ color: feedback.score >= 80 ? "#10b981" : feedback.score >= 60 ? "#f59e0b" : "#ef4444" }}>
                        {getScoreReaction(feedback.score).emoji} {getScoreReaction(feedback.score).label}
                      </p>
                    </div>
                  </div>

                  {/* 良かった点 */}
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-400 font-bold text-sm mb-2">✅ ここは自信を持って！</p>
                    <ul className="space-y-1">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="text-slate-300 text-sm">{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 改善点 */}
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-amber-400 font-bold text-sm mb-2">💡 次はここを磨こう</p>
                    <ul className="space-y-1">
                      {feedback.improvements.map((s, i) => (
                        <li key={i} className="text-slate-300 text-sm">{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 追加質問 */}
                  <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <p className="text-violet-400 font-bold text-sm mb-2">🎯 審査員がさらに掘ってきそうな質問</p>
                    <p className="text-slate-300 text-sm">「{sq(feedback.followUpSuggestion)}」</p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="ghost" className="flex-1 border border-white/10" onClick={() => { setPhase("answering"); setFeedback(null); setAnswer(""); speech.reset(); }}>
                      もう一度答える
                    </Button>
                    <Button className="flex-1" onClick={() => setPhase("questions")}>
                      <Zap className="w-4 h-4" /> 次の質問へ行く
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
