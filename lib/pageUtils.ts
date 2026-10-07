import { TestSection, Question } from "@/types/quiz";
import { resolveAnswerLayout, isSameLineEligible } from "./answerUtils";

/**
 * 設問1問あたりの用紙上の高さ重みを算出
 * - 同一行（same-line: 英単語・短問）: 0.55
 * - 通常の短答（2行構造）: 1.0
 * - 模範解答付（解答サイズ）時: 解答ボックス・解説・台本の高さを加算
 * - 英文・並べ替え・記述（stacked）: 1.6
 * - 図形SVGあり: 2.0
 */
export function calculateQuestionWeight(
  q: Question,
  is2Col: boolean = false,
  sheetMode: "student" | "teacher" = "student"
): number {
  const hasMedia = Boolean(
    (q.figureSvg && q.figureSvg.trim().length > 0) ||
    (q.imageUrl && q.imageUrl.trim().length > 0) ||
    (q.audioUrl && q.audioUrl.trim().length > 0) ||
    q.hasImagePlaceholder
  );
  const isSameLine = isSameLineEligible({
    questionText: q.questionText,
    answer: q.answer,
    is2Col,
    hasMedia,
    configuredLayout: q.answerLayout,
  });

  let weight = isSameLine ? 0.55 : 1.0;

  // 模範解答付モード（解答サイズ）時: 模範解答枠や解説文の分だけ縦消費が増加
  if (sheetMode === "teacher") {
    weight += 0.45; // 模範解答ボックスの追加分
    if (q.explanation && q.explanation.trim().length > 0) {
      const expLines = q.explanation.split("\n").length;
      weight += 0.35 + Math.min(1.0, expLines * 0.18); // 解説文の追加分
    }
  }

  // 解答欄レイアウトが stacked（各問1行）の場合
  const layout = resolveAnswerLayout(q.answerLayout, q.questionText, q.answer);
  if (layout === "stacked") {
    weight += 0.6;
  }

  // 図形SVGまたは画像（画像欄含む）がある場合
  if (
    (q.figureSvg && q.figureSvg.trim().length > 0) ||
    (q.imageUrl && q.imageUrl.trim().length > 0) ||
    q.hasImagePlaceholder
  ) {
    weight += 1.0;
  }

  // 放送原稿・台本がある場合（教師用印刷時の高さ考慮）
  if (q.audioScript && q.audioScript.trim().length > 0) {
    const scriptLines = q.audioScript.split("\n").length;
    weight += 0.5 + Math.min(1.0, scriptLines * 0.15);
  }

  // 問題文の行数が多い場合
  const lines = (q.questionText || "").split("\n").length;
  if (lines > 3) {
    weight += (lines - 3) * 0.25;
  }

  return weight;
}

/**
 * 大問セクション全体の用紙上の高さ重みを算出
 */
export function calculateSectionWeight(
  section: TestSection,
  sheetMode: "student" | "teacher" = "student"
): number {
  if (!section.questions || section.questions.length === 0) {
    return 0.5; // 空の大問見出し分の重み
  }

  const isShortVocabularySection = section.questions.length >= 2 && section.questions.every(
    q => q.questionText.length <= 42 && !q.figureSvg && !q.imageUrl && !q.audioUrl && !q.hasImagePlaceholder
  );
  const is2Col = section.layout === "2col" || (section.layout !== "1col" && isShortVocabularySection);

  // 大問見出し（0.8） + 各設問の重み合計
  const rawQuestionsWeight = section.questions.reduce(
    (sum, q) => sum + calculateQuestionWeight(q, is2Col, sheetMode),
    0
  );

  // 2列グリッドの場合は左右2列に並ぶため縦方向の消費は半分強
  const questionsWeight = is2Col ? rawQuestionsWeight * 0.55 : rawQuestionsWeight;
  return 0.8 + questionsWeight;
}

/**
 * 各大問セクションの所属ページ番号（1, 2, ...）を解決する（後方互換用）
 */
export function resolveSectionPages(
  sections: TestSection[],
  options?: { sheetMode?: "student" | "teacher"; paperMode?: "a4" | "b4" }
): { section: TestSection; secIdx: number; page: number }[] {
  const sheetMode = options?.sheetMode ?? "student";
  const paperMode = options?.paperMode ?? "a4";

  let currentPage = 1;
  let currentPageWeight = 0;

  return sections.map((section, secIdx) => {
    const secWeight = calculateSectionWeight(section, sheetMode);

    // 手動でページ指定がある場合
    if (typeof section.page === "number" && section.page >= 1) {
      currentPage = section.page;
      currentPageWeight = secWeight;
      return { section, secIdx, page: currentPage };
    }

    // 自動判定: B4半面は高さ257mm（A4の297mmより約14%低い）ため容量を抑えめに設定
    const pageCapacity = paperMode === "b4"
      ? (currentPage === 1 ? 6.5 : 8.5)
      : (currentPage === 1 ? 8.0 : 10.0);

    // 現在のページにまだ空きがない、かつ現在のページに既に何らかの大問が存在する場合に改ページ
    if (currentPageWeight > 0 && currentPageWeight + secWeight > pageCapacity) {
      currentPage += 1;
      currentPageWeight = secWeight;
    } else {
      currentPageWeight += secWeight;
    }

    return { section, secIdx, page: currentPage };
  });
}

/**
 * ページネーション後にページごとに描画される大問・小問ブロック情報
 */
export type PageSectionItem = {
  section: TestSection;
  secIdx: number;
  questions: Question[];
  isContinuation?: boolean;
  questionOffset: number;
};

/**
 * ページ番号ごとに大問をグループ化して返す
 * - 大問内の問題数が多く1ページに収まらない場合は、ページ容量に合わせて大問内で次ページへ自動分割・繰り越し
 * - B4用紙（高さ257mm）や模範解答付（解答サイズ）時の高さ増加に完全追従し、設問消失（オーバーフロー）を徹底防止
 */
export function groupSectionsByPage(
  sections: TestSection[],
  options?: {
    sheetMode?: "student" | "teacher";
    paperMode?: "a4" | "b4";
  }
): Map<number, PageSectionItem[]> {
  const sheetMode = options?.sheetMode ?? "student";
  const paperMode = options?.paperMode ?? "a4";

  // 用紙ごとのキャパシティ（B4の半面は高さ257mmとA4の297mmより低いため控えめに設定）
  const getCapacity = (page: number) => {
    if (paperMode === "b4") {
      return page === 1 ? 6.8 : 8.8;
    }
    return page === 1 ? 8.2 : 10.5;
  };

  const pageMap = new Map<number, PageSectionItem[]>();
  pageMap.set(1, []);

  let currentPage = 1;
  let currentPageWeight = 0;

  sections.forEach((section, secIdx) => {
    if (!section.questions || section.questions.length === 0) {
      const list = pageMap.get(currentPage) || [];
      list.push({
        section,
        secIdx,
        questions: [],
        questionOffset: 0,
      });
      pageMap.set(currentPage, list);
      return;
    }

    const isShortVocabularySection = section.questions.length >= 2 && section.questions.every(
      q => q.questionText.length <= 42 && !q.figureSvg && !q.imageUrl && !q.audioUrl && !q.hasImagePlaceholder
    );
    const is2Col = section.layout === "2col" || (section.layout !== "1col" && isShortVocabularySection);

    // ユーザーが手動で page を指定しており、現在のページより大きい場合は進める
    if (typeof section.page === "number" && section.page > currentPage) {
      currentPage = section.page;
      currentPageWeight = 0;
    }

    let qIdx = 0;
    let isCont = false;

    while (qIdx < section.questions.length) {
      const pageCap = getCapacity(currentPage);
      const headerWeight = isCont ? 0.35 : 0.75;

      // 現在のページにすでに大問があり、ヘッダーすら入りにくい場合は次ページへ改ページ
      if (currentPageWeight > 0 && currentPageWeight + headerWeight + 0.8 > pageCap) {
        currentPage += 1;
        currentPageWeight = 0;
      }

      currentPageWeight += headerWeight;
      const startQIdx = qIdx;
      const pageQuestions: Question[] = [];

      while (qIdx < section.questions.length) {
        const q = section.questions[qIdx];
        const qWeight = calculateQuestionWeight(q, is2Col, sheetMode) * (is2Col ? 0.55 : 1.0);

        // ページにまだ1問も入っていない場合は、どんなに大きくても最低1問は配置（無限ループ防止）
        if (pageQuestions.length === 0) {
          pageQuestions.push(q);
          currentPageWeight += qWeight;
          qIdx++;
        } else if (currentPageWeight + qWeight <= getCapacity(currentPage)) {
          pageQuestions.push(q);
          currentPageWeight += qWeight;
          qIdx++;
        } else {
          // このページの容量を超えたため、次のページへ繰り越す
          currentPage += 1;
          currentPageWeight = 0;
          break;
        }
      }

      const list = pageMap.get(currentPage) || [];
      list.push({
        section,
        secIdx,
        questions: pageQuestions,
        isContinuation: isCont,
        questionOffset: startQIdx,
      });
      pageMap.set(currentPage, list);

      isCont = true;
    }
  });

  return pageMap;
}

/**
 * 全大問中の最大ページ番号を取得（最低1）
 */
export function getMaxPageNumber(
  sections: TestSection[],
  options?: { sheetMode?: "student" | "teacher"; paperMode?: "a4" | "b4" }
): number {
  const pageMap = groupSectionsByPage(sections, options);
  return Math.max(1, ...Array.from(pageMap.keys()));
}

