/**
 * Mini-JSON (外部AIからのコピペ取込用・トークン最小化短縮スキーマ)
 */
export interface MiniJsonQuestion {
  gr?: string;       // 学年 (e.g., "中2", "中1", "高1")
  tb?: string;       // 教科書名・教材名 (e.g., "新しい数学2", "啓林館")
  g?: string;        // ジャンル・教科 (e.g., "数学", "歴史")
  t?: string;        // メイン単元 (e.g., "円周角の定理")
  st?: string;       // サブ論点 (e.g., "中心角と円周角の関係")
  tg?: string[];     // タグ (e.g., ["頻出", "基礎", "計算力"])
  d?: number;        // 難易度 (1: 基礎, 2: 標準, 3: 発展)
  s?: number;        // 想定所要時間 (秒)
  q: string;         // 問題文 (TeX数式 \( ... \) 対応)
  a: string;         // 解答
  al?: string[];     // 解答欄ラベル（省略可: ["yの値", "xの増加量", "yの増加量"] 等）
  ly?: "inline" | "stacked" | "same-line"; // 解答欄レイアウト (省略可: inline=横並び短縮, stacked=各小問1行記述, same-line=問題文と同一行インライン)
  e?: string;        // 解説
  svg?: string;      // 幾何図形・座標SVG (<svg>...</svg>)
  img?: string;      // 画像URL・パス (e.g., "/uploads/images/...")
  aud?: string;      // 音声URL・パス (リスニング用)
  as?: string;       // 放送台本・原稿 (教師用プリント用)
  origQ?: string;    // 元の全小問を含む問題文（間引き前の完全版）
  origA?: string;    // 元の全解答
  origE?: string;    // 元の全解説
  selIdx?: number[]; // 選択されている小問インデックス (0-indexed)
  disSub?: boolean;  // 枝問自動分割を意図的に無効化
}


/**
 * Mini-JSONパッケージメタデータ
 */
export interface MiniJsonMetadata {
  textbook?: string;   // 教科書名・教材名
  grade?: string;      // 対象学年
  subject?: string;    // 教科・ジャンル
  tags?: string[];     // 全体タグ
  exportedAt?: string; // エクスポート日時
}

/**
 * Mini-JSONパッケージ（メタデータ付きオブジェクト形式）
 */
export interface MiniJsonPackage {
  meta?: MiniJsonMetadata;
  questions: MiniJsonQuestion[];
}

/**
 * アプリ内部で扱う標準問題モデル
 */
export interface Question {
  id: string;
  grade?: string;      // 学年 (e.g., "中2", "中1", "高1")
  textbook?: string;   // 教科書名 (e.g., "東京書籍 新しい数学2", "啓林館 未来へひろがる数学2")
  genre: string;
  topic: string;
  subTopic: string;
  tags: string[];
  difficulty: number;  // 1 ~ 3
  estimatedSeconds: number;
  questionText: string;
  answer: string;
  answerLabels?: string[]; // 複数解答欄ラベル（省略時はパーサーが自動判別）
  answerLayout?: "auto" | "inline" | "stacked" | "same-line"; // 解答欄レイアウト形式
  explanation: string;
  figureSvg?: string;
  imageUrl?: string;                // 画像URL・ファイルパス (e.g., "/uploads/images/...")
  audioUrl?: string;               // 音声URL・ファイルパス (リスニング用)
  audioScript?: string;            // 放送台本・原稿 (生徒用紙非表示・教師用紙に印字)
  defaultPoints: number;
  originalQuestionText?: string;    // 元の全小問を含む問題文（間引き前の完全版）
  originalAnswer?: string;          // 元の全解答
  originalExplanation?: string;     // 元の全解説
  selectedSubItemIndices?: number[]; // 選択されている小問インデックス (0-indexed)
  isSubItemDisabled?: boolean;      // 枝問自動分割を意図的に無効化
  customLineWidth?: number;         // ユーザー指定の解答欄下線幅 (px: 自由調整用)
  answerAlign?: "right" | "left" | "center"; // 解答欄の横位置 (省略時は right)
  mergedFromSectionTitle?: string;  // マージ元の大問名
  mergedQuestions?: Question[];     // マージされた元の小問一覧 (マージ解除・復元用)
  itemColumns?: 1 | 2;              // 小問アイテムの列数（1行あたりの単語数: 1列 or 2列グリッド）
}

/**
 * アプリ設定 & タグマスター
 */
export interface AppSettings {
  defaultGrade?: string;     // デフォルト学年 (e.g., "中2")
  defaultTextbook?: string;  // デフォルト教科書名 (e.g., "東京書籍 新しい数学")
  tagMaster: string[];       // 登録済みタグマスター一覧
}

/**
 * 大問セクションモデル
 */
export interface TestSection {
  id: string;
  title: string;
  targetPoints: number;
  questions: Question[];
  page?: number; // 配置ページ番号 (1, 2, ... 省略時は1または自動計算)
  layout?: "auto" | "1col" | "2col"; // 大問の設問レイアウト（auto: 自動判定, 1col: 縦1列, 2col: 左右2列英単語・短問用）
  mergedSectionTitles?: string[];    // マージされた元の大問タイトル一覧 (マージ解除・復元用)
}

/**
 * テスト全体モデル
 */
export interface QuizTest {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  timeLimitMinutes?: number;
  totalTargetPoints: number;
  sections: TestSection[];
}
