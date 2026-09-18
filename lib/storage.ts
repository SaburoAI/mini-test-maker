import { Question, QuizTest, MiniJsonQuestion, MiniJsonMetadata, MiniJsonPackage, AppSettings } from "@/types/quiz";
import { INITIAL_QUESTION_POOL, INITIAL_TEST } from "./seedData";

const STORAGE_KEY_POOL = "mini_test_maker_pool_v3";
const STORAGE_KEY_TEST = "mini_test_maker_current_test_v3";
const STORAGE_KEY_SETTINGS = "mini_test_maker_settings_v1";

export const DEFAULT_TAG_MASTER: string[] = [
  "頻出",
  "基礎",
  "標準",
  "発展",
  "計算力",
  "定期テスト",
  "入試過去問",
  "図形問題",
  "ミス多発",
  "公式利用",
  "文章題",
  "中2数学",
  "1次関数",
  "平行と合同"
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultGrade: "中2",
  defaultTextbook: "東京書籍 新しい数学",
  tagMaster: DEFAULT_TAG_MASTER
};

/**
 * アプリ基本設定 & タグマスターの取得
 */
export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!saved) {
      saveAppSettings(DEFAULT_APP_SETTINGS);
      return DEFAULT_APP_SETTINGS;
    }
    const parsed: AppSettings = JSON.parse(saved);
    return {
      defaultGrade: parsed.defaultGrade || DEFAULT_APP_SETTINGS.defaultGrade,
      defaultTextbook: parsed.defaultTextbook || DEFAULT_APP_SETTINGS.defaultTextbook,
      tagMaster: Array.isArray(parsed.tagMaster) && parsed.tagMaster.length > 0
        ? parsed.tagMaster
        : DEFAULT_TAG_MASTER
    };
  } catch (err) {
    console.error("Failed to load settings from localStorage:", err);
    return DEFAULT_APP_SETTINGS;
  }
}

/**
 * アプリ基本設定 & タグマスターの保存
 */
export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
  }
}

/**
 * ローカルストレージから問題プールを取得
 */
export function loadQuestionPool(): Question[] {
  if (typeof window === "undefined") return INITIAL_QUESTION_POOL;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_POOL);
    if (!saved) {
      saveQuestionPool(INITIAL_QUESTION_POOL);
      return INITIAL_QUESTION_POOL;
    }
    const pool: Question[] = JSON.parse(saved);
    // 既存の問題に grade がなければ自動推論で付与
    return pool.map(q => {
      if (q.grade) return q;
      const inferred = inferGrade({ tg: q.tags, t: q.topic, q: q.questionText });
      return { ...q, grade: inferred || "中2" };
    });
  } catch (err) {
    console.error("Failed to load pool from localStorage:", err);
    return INITIAL_QUESTION_POOL;
  }
}

/**
 * ローカルストレージへ問題プールを保存
 */
export function saveQuestionPool(pool: Question[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_POOL, JSON.stringify(pool));
  } catch (err) {
    console.error("Failed to save pool to localStorage:", err);
  }
}

/**
 * ローカルストレージから作成中テストを取得
 */
export function loadCurrentTest(): QuizTest {
  if (typeof window === "undefined") return INITIAL_TEST;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TEST);
    if (!saved) {
      saveCurrentTest(INITIAL_TEST);
      return INITIAL_TEST;
    }
    const test: QuizTest = JSON.parse(saved);
    // 既存テスト内の seed-q1 の SVG を最新の数学的厳密座標に更新
    const updatedSections = test.sections.map(sec => ({
      ...sec,
      questions: sec.questions.map(q =>
        q.id === "seed-q1" ? { ...q, figureSvg: INITIAL_QUESTION_POOL[0].figureSvg } : q
      )
    }));
    return { ...test, sections: updatedSections };
  } catch (err) {
    console.error("Failed to load test from localStorage:", err);
    return INITIAL_TEST;
  }
}

/**
 * ローカルストレージへ作成中テストを保存
 */
export function saveCurrentTest(test: QuizTest): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_TEST, JSON.stringify(test));
  } catch (err) {
    console.error("Failed to save test to localStorage:", err);
  }
}

/* =========================================================================
   Googleスプレッドシート連携（TSV/CSV互換）＆ Mini-JSON変換レイヤー
   ========================================================================= */

/**
 * タグや問題文などから学年を自動推論（過去のJSONやgr未設定データの救済用）
 */
export function inferGrade(item: { gr?: string; tg?: string[]; t?: string; q?: string }): string | undefined {
  if (item.gr && item.gr.trim()) return item.gr.trim();

  // タグから推論 (例: "中2数学", "中1理科", "高1", "中3")
  const tagsStr = (item.tg || []).join(" ");
  const matchTag = tagsStr.match(/(中[123１２３]|高[123１２３]|小[1-6１-６]|中[一二三]|高[一二三]|小[一二三四五六])/);
  if (matchTag) {
    const g = matchTag[1].normalize("NFKC");
    const kanjiMap: Record<string, string> = { "中一": "中1", "中二": "中2", "中三": "中3" };
    return kanjiMap[g] || g;
  }

  // 単元や問題文から推論
  const textStr = `${item.t || ""} ${item.q || ""}`;
  const matchText = textStr.match(/(中[123１２３]|高[123１２３]|小[1-6１-６]|第[123１２３]学年)/);
  if (matchText) {
    const raw = matchText[1].normalize("NFKC");
    if (raw.includes("第")) {
      const num = raw.match(/\d/);
      return num ? `中${num[0]}` : undefined;
    }
    return raw;
  }

  return undefined;
}

/**
 * 問題配列を Google スプレッドシート貼り付け用 TSV 文字列に変換
 * ヘッダー: 学年 \t 教科書 \t ジャンル \t メイン単元 \t サブ論点 \t タグ \t 難易度 \t 想定秒数 \t 問題文 \t 解答 \t 解説 \t SVG
 */
export function exportQuestionsToTsv(questions: Question[]): string {
  const header = ["学年", "教科書", "ジャンル", "メイン単元", "サブ論点", "タグ", "難易度", "想定秒数", "問題文", "解答", "解説", "SVG図形", "画像URL", "音声URL", "放送台本"];
  const rows = questions.map(q => [
    q.grade || "",
    q.textbook || "",
    q.genre || "",
    q.topic || "",
    q.subTopic || "",
    (q.tags || []).join(","),
    q.difficulty || 2,
    q.estimatedSeconds || 60,
    (q.questionText || "").replace(/\r?\n/g, "\\n"),
    (q.answer || "").replace(/\r?\n/g, "\\n"),
    (q.explanation || "").replace(/\r?\n/g, "\\n"),
    (q.figureSvg || "").replace(/\r?\n/g, " "),
    q.imageUrl || "",
    q.audioUrl || "",
    (q.audioScript || "").replace(/\r?\n/g, "\\n")
  ]);
  return [header.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
}

/**
 * Google スプレッドシート等からコピーした TSV 文字列を Question 配列にパース
 */
export function importQuestionsFromTsv(tsvText: string, fallbackMeta?: { grade?: string; textbook?: string; tags?: string[] }): Question[] {
  const lines = tsvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const firstLine = lines[0].split("\t");
  const hasHeader = firstLine.some(col => col.includes("学年") || col.includes("教科書") || col.includes("ジャンル") || col.includes("単元") || col.includes("問題文"));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const hasGradeCol = firstLine[0]?.includes("学年");
  const hasTbCol = firstLine[1]?.includes("教科書");

  return dataLines.map((line, idx) => {
    const cols = line.split("\t");
    let grade: string | undefined = fallbackMeta?.grade;
    let textbook: string | undefined = fallbackMeta?.textbook;
    let colOffset = 0;

    if (hasGradeCol) {
      const g = cols[0]?.trim();
      if (g) grade = g;
      colOffset = 1;
    }
    if (hasTbCol) {
      const tb = cols[1]?.trim();
      if (tb) textbook = tb;
      colOffset = 2;
    }

    const genre = cols[colOffset]?.trim() || "一般";
    const topic = cols[colOffset + 1]?.trim() || "単元未設定";
    const subTopic = cols[colOffset + 2]?.trim() || "基本";
    
    let rawTags = cols[colOffset + 3] ? cols[colOffset + 3].split(",").map(t => t.trim()).filter(Boolean) : [];
    if (rawTags.length === 0) {
      rawTags = fallbackMeta?.tags && fallbackMeta.tags.length > 0 ? [...fallbackMeta.tags] : ["インポート"];
    } else if (fallbackMeta?.tags && fallbackMeta.tags.length > 0) {
      const tagSet = new Set([...rawTags, ...fallbackMeta.tags]);
      rawTags = Array.from(tagSet);
    }

    const difficulty = parseInt(cols[colOffset + 4] || "2", 10) || 2;
    const estimatedSeconds = parseInt(cols[colOffset + 5] || "60", 10) || 60;
    const questionText = (cols[colOffset + 6] || "").replace(/\\n/g, "\n");
    const answer = (cols[colOffset + 7] || "").replace(/\\n/g, "\n");
    const explanation = (cols[colOffset + 8] || "").replace(/\\n/g, "\n");
    const figureSvg = cols[colOffset + 9]?.trim() || undefined;
    const imageUrl = cols[colOffset + 10]?.trim() || undefined;
    const audioUrl = cols[colOffset + 11]?.trim() || undefined;
    const audioScript = cols[colOffset + 12] ? cols[colOffset + 12].replace(/\\n/g, "\n").trim() : undefined;

    const inferred = grade || inferGrade({ tg: rawTags, t: topic, q: questionText });

    return {
      id: `imported-tsv-${Date.now()}-${idx}`,
      grade: inferred,
      textbook,
      genre,
      topic,
      subTopic,
      tags: rawTags,
      difficulty,
      estimatedSeconds,
      questionText: questionText || "問題文なし",
      answer,
      explanation,
      figureSvg,
      imageUrl,
      audioUrl,
      audioScript,
      defaultPoints: difficulty === 3 ? 12 : (difficulty === 2 ? 10 : 8)
    };
  });
}

/**
 * 問題配列を Mini-JSON 配列文字列に変換
 * @param questions 対象問題一覧
 * @param metadata オプションのパッケージメタデータ（教科書名、学年、タグ等）
 */
export function exportQuestionsToMiniJson(questions: Question[], metadata?: MiniJsonMetadata): string {
  const miniList: MiniJsonQuestion[] = questions.map(q => ({
    gr: q.grade || undefined,
    tb: q.textbook || undefined,
    g: q.genre,
    t: q.topic,
    st: q.subTopic,
    tg: q.tags,
    d: q.difficulty,
    s: q.estimatedSeconds,
    q: q.questionText,
    a: q.answer,
    al: q.answerLabels && q.answerLabels.length > 0 ? q.answerLabels : undefined,
    ly: q.answerLayout && q.answerLayout !== "auto" ? q.answerLayout : undefined,
    e: q.explanation || undefined,
    svg: q.figureSvg || undefined,
    img: q.imageUrl || undefined,
    aud: q.audioUrl || undefined,
    as: q.audioScript || undefined,
    origQ: q.originalQuestionText || undefined,
    origA: q.originalAnswer || undefined,
    origE: q.originalExplanation || undefined,
    selIdx: q.selectedSubItemIndices && q.selectedSubItemIndices.length > 0 ? q.selectedSubItemIndices : undefined,
    disSub: q.isSubItemDisabled || undefined
  }));

  // メタデータがある場合、または代表教科書名・学年を集約できる場合はパッケージ形式で出力
  const firstTb = metadata?.textbook || questions.find(q => q.textbook)?.textbook;
  const firstGrade = metadata?.grade || questions.find(q => q.grade)?.grade;

  const pkg: MiniJsonPackage = {
    meta: {
      textbook: firstTb || undefined,
      grade: firstGrade || undefined,
      subject: metadata?.subject || questions[0]?.genre || undefined,
      tags: metadata?.tags || undefined,
      exportedAt: metadata?.exportedAt || new Date().toISOString().split("T")[0]
    },
    questions: miniList
  };

  // メタ情報が何もなければシンプルな配列で出力
  const hasMeta = pkg.meta && (pkg.meta.textbook || pkg.meta.grade || (pkg.meta.tags && pkg.meta.tags.length > 0));
  if (!hasMeta && !metadata) {
    return JSON.stringify(miniList, null, 2);
  }

  return JSON.stringify(pkg, null, 2);
}

/**
 * 外部AI等からコピペされた Mini-JSON 文字列を Question 配列にパース
 * ※ 配列直形式 `[...]` と パッケージ形式 `{ meta, questions }` の双方に対応
 * ※ gr（学年）や tb（教科書名）が未設定でも、metaやUI指定値から自動で補完します
 */
export function importQuestionsFromMiniJson(
  rawJson: string,
  fallbackMeta?: { grade?: string; textbook?: string; tags?: string[] }
): Question[] {
  const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  let list: MiniJsonQuestion[] = [];
  let meta: MiniJsonMetadata | undefined;

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.questions)) {
      list = parsed.questions;
      meta = parsed.meta;
    } else {
      list = [parsed];
    }
  }

  const effectiveGrade = meta?.grade || fallbackMeta?.grade;
  const effectiveTb = meta?.textbook || fallbackMeta?.textbook;
  const effectiveTags = meta?.tags || fallbackMeta?.tags;

  return list.map((item, idx) => {
    const grade = item.gr || effectiveGrade || inferGrade(item);
    const textbook = item.tb || effectiveTb || undefined;

    let itemTags: string[] = Array.isArray(item.tg) ? [...item.tg] : [];
    if (itemTags.length === 0) {
      itemTags = effectiveTags && effectiveTags.length > 0 ? [...effectiveTags] : ["新規取込"];
    } else if (effectiveTags && effectiveTags.length > 0) {
      const set = new Set([...itemTags, ...effectiveTags]);
      itemTags = Array.from(set);
    }

    return {
      id: `imported-json-${Date.now()}-${idx}`,
      grade,
      textbook,
      genre: item.g || "一般",
      topic: item.t || "単元未設定",
      subTopic: item.st || "基本",
      tags: itemTags,
      difficulty: item.d || 2,
      estimatedSeconds: item.s || 60,
      questionText: item.q || "問題文",
      answer: item.a || "",
      answerLabels: Array.isArray(item.al) ? item.al.map(l => String(l).trim()).filter(Boolean) : undefined,
      answerLayout: item.ly === "inline" || item.ly === "stacked" || item.ly === "same-line" ? item.ly : undefined,
      explanation: item.e || "",
      figureSvg: item.svg || undefined,
      imageUrl: item.img || undefined,
      audioUrl: item.aud || undefined,
      audioScript: item.as || undefined,
      defaultPoints: item.d === 3 ? 12 : (item.d === 2 ? 10 : 8),
      originalQuestionText: item.origQ || undefined,
      originalAnswer: item.origA || undefined,
      originalExplanation: item.origE || undefined,
      selectedSubItemIndices: Array.isArray(item.selIdx) ? item.selIdx : undefined,
      isSubItemDisabled: item.disSub || undefined
    };
  });
}
