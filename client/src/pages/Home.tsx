import { motion } from "framer-motion";
import { BookOpen, Mic, Trophy, Sparkles, ChevronRight, Zap, Users, Star } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useSceneBGM } from "@/hooks/useSceneBGM";
import { MuteButton } from "@/components/MuteButton";

const features = [
  {
    phase: "Phase 1",
    icon: Mic,
    title: "壁打ちモード",
    subtitle: "最強の練習相手",
    description:
      "本のタイトルと感動ポイントを入力するだけで、AIが2〜3分プレゼンの構成案を3パターン提案。さらにAIが仮想オーディエンスとなって鋭い質問を投げかけ、本番力を鍛えます。",
    href: "/assist",
    gradient: "from-violet-600 to-indigo-600",
    glow: "shadow-violet-500/30",
    badge: "NOW OPEN",
    badgeColor: "bg-emerald-500",
    features: ["プレゼン構成アシスト", "模擬Q&Aセッション", "回答フィードバック"],
  },
  {
    phase: "Phase 2",
    icon: Trophy,
    title: "ドリームマッチ",
    subtitle: "偉人AIとの激突",
    description:
      "太宰治や夏目漱石などのAIキャラクターが現代の本をプレゼン。あなたがオーディエンスとなって「チャンプ本」に投票できます。",
    href: "/dream",
    gradient: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/30",
    badge: "NOW OPEN",
    badgeColor: "bg-amber-500",
    features: ["4人の文豪AIキャラクター", "チャンプ本投票", "読み上げ機能"],
  },
  {
    phase: "Phase 3",
    icon: Star,
    title: "バトラー推薦",
    subtitle: "本との新しい出会い",
    description:
      "4人の個性豊かなAIバトラーが毎日違う本をショートプレゼン。あなたの投票でAIが進化し、あなたの心に刺さる本を紹介し続けます。",
    href: "/battler",
    gradient: "from-pink-500 to-rose-500",
    glow: "shadow-pink-500/30",
    badge: "NOW OPEN",
    badgeColor: "bg-emerald-500",
    features: ["4人のAIバトラー", "投票で学習進化", "パーソナライズ推薦"],
  },
];

const stats = [
  { icon: Zap, label: "AI構成パターン", value: "3種類" },
  { icon: Users, label: "仮想オーディエンス質問", value: "最大8問" },
  { icon: BookOpen, label: "書籍検索", value: "数百万冊" },
];

export default function Home() {
  useSceneBGM("home");
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* 背景エフェクト */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* ヘッダー */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">AIビブリオスタジアム</span>
          </div>
          <div className="flex items-center gap-2">
            <MuteButton />
            <Link href="/assist">
              <Button size="sm" className="hidden sm:flex">
                練習を始める <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        {/* ヒーロー */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-6 text-sm text-violet-300">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Claude AI
          </div>
          <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-tight">
            ビブリオバトルを
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
              AIと制する
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            プレゼン構成から模擬Q&A、偉人AIとのバトルまで。
            <br />
            あなたのビブリオバトルを次のレベルへ。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/assist">
              <Button size="xl">
                <Zap className="w-5 h-5" />
                壁打ちを始める（無料）
              </Button>
            </Link>
            <button
              onClick={() =>
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition-all duration-200"
            >
              <BookOpen className="w-5 h-5" />
              アプリを知る
            </button>
          </div>
        </motion.div>

        {/* スタッツ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-24 max-w-2xl mx-auto"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-2xl bg-white/5 border border-white/10"
            >
              <stat.icon className="w-5 h-5 text-violet-400 mx-auto mb-2" />
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* フィーチャーカード */}
        <div id="features" className="space-y-6">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-10"
          >
            3つのフェーズ
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.phase}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i + 0.3 }}
              >
                <Link href={feature.href} className="block h-full">
                  <div className="relative rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 p-6 h-full flex flex-col transition-all duration-300 cursor-pointer group">
                    {/* バッジ */}
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-bold text-slate-500 tracking-widest">
                        {feature.phase}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${feature.badgeColor}`}
                      >
                        {feature.badge}
                      </span>
                    </div>

                    {/* アイコン */}
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg ${feature.glow}`}
                    >
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="text-xl font-black mb-1 text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-500 mb-3">{feature.subtitle}</p>
                    <p className="text-sm text-slate-400 leading-relaxed mb-5">
                      {feature.description}
                    </p>

                    {/* 機能リスト */}
                    <ul className="space-y-2 mb-6 flex-1">
                      {feature.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                          <div
                            className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${feature.gradient}`}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="w-full py-2.5 px-4 rounded-xl bg-white/10 group-hover:bg-white/15 border border-white/10 group-hover:border-white/20 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200">
                      入場する <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* フッター */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-24 text-slate-600 text-sm"
        >
          <p>AIビブリオスタジアム — ビブリオバトルをAIで進化させる</p>
        </motion.footer>
      </main>
    </div>
  );
}
