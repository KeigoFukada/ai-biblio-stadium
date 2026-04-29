export type PresentationStyle = "logical" | "story" | "emotional";

export interface PresentationStructure {
  style: PresentationStyle;
  styleLabel: string;
  styleDescription: string;
  sections: {
    title: string;
    duration: string;
    content: string;
    tips: string;
  }[];
  openingHook: string;
  closingLine: string;
}

export interface BookInfo {
  id: string;
  title: string;
  authors: string[];
  description: string;
  thumbnail?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
}

export interface QAQuestion {
  id: string;
  question: string;
  type: "sharp" | "curious" | "clarification" | "opinion";
  typeLabel: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QAFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  followUpSuggestion: string;
}

// ─── Phase 2: DreamMatch ───────────────────────────────────────
export type CharacterId = "dazai" | "soseki" | "kenji" | "akutagawa";

export interface DreamCharacter {
  id: CharacterId;
  name: string;
  era: string;
  style: string;
  avatar: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
}

export interface CharacterPresentation {
  character: DreamCharacter;
  bookTitle: string;
  bookAuthor: string;
  opening: string;
  body: string;
  closing: string;
  recommendation: string;
}

export interface DreamBattle {
  id: string;
  side1: CharacterPresentation;
  side2: CharacterPresentation;
  votes1: number;
  votes2: number;
}

// ─── Phase 3: バトラー推薦 ───────────────────────────────────
export type BattlerId = "ryo" | "mika" | "ken" | "haru";

export interface Battler {
  id: BattlerId;
  name: string;
  emoji: string;
  tagline: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface BattlerPick {
  battler: Battler;
  bookTitle: string;
  bookAuthor: string;
  hook: string;      // 1文の掴み
  pitch: string;     // 2〜3文のプレゼン本文
  target: string;    // こんな人に
  keyword: string;   // この本を表す1ワード
}

export interface BattlerPreference {
  battlerVotes: Record<string, number>;  // battlerId → vote count
  keywords: string[];                    // 投票した本のkeyword履歴
  sessionCount: number;
}
