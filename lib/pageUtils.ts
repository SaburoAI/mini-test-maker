import { TestSection, Question } from "@/types/quiz";
import { resolveAnswerLayout, isSameLineEligible } from "./answerUtils";

/**
 * 設問1問あたりの用紙上の高さ重みを算出
 * - 同一行（same-line: 英単語・短問）: 0.55
 * - 通常の短答（2行構造）: 1.0
 * - 英文・並べ替え・記述（stacked）: 1.6
 * - 図形SVGあり: 2.0
 * - 問題文の行数が多い場合にも加算
 */
export function calculateQuestionWeight(q: Question, is2Col: boolean = false): number {
  const hasMedia = Boolean((q.figureSvg && q.figureSvg.trim().length > 0) || (q.imageUrl && q.imageUrl.trim().length > 0) || (q.audioUrl && q.audioUrl.trim().length > 0));
  const isSameLine = isSameLineEligible({
    questionText: q.questionText,
    answer: q.answer,
    is2Col,
    hasMedia,
    configuredLayout: q.answerLayout,
  });

  if (isSameLine) {
    return 0.55; // 同一行配置のため高さ消費が半分
  }

  let weight = 1.0;

  // 解答欄レイアウトが stacked（各問1行）の場合
  const layout = resolveAnswerLayout(q.answerLayout, q.questionText, q.answer);
  if (layout === "stacked") {
    weight += 0.6;
  }

  // 図形SVGまたは画像がある場合
  if ((q.figureSvg && q.figureSvg.trim().length > 0) || (q.imageUrl && q.imageUrl.trim().length > 0)) {
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
export function calculateSectionWeight(section: TestSection): number {
  if (!section.questions || section.questions.length === 0) {
    return 0.5; // 空の大問見出し分の重み
  }

  const isShortVocabularySection = section.questions.length >= 2 && section.questions.every(
    q => q.questionText.length <= 42 && !q.figureSvg && !q.imageUrl && !q.audioUrl
  );
  const is2Col = section.layout === "2col" || (section.layout !== "1col" && isShortVocabularySection);

  // 大問見出し（0.8） + 各設問の重み合計
  const rawQuestionsWeight = section.questions.reduce(
    (sum, q) => sum + calculateQuestionWeight(q, is2Col),
    0
  );

  // 2列グリッドの場合は左右2列に並ぶため縦方向の消費は半分強
  const questionsWeight = is2Col ? rawQuestionsWeight * 0.55 : rawQuestionsWeight;
  return 0.8 + questionsWeight;
}

/**
 * 各大問セクションの所属ページ番号（1, 2, ...）を解決する
 * - 手動で sec.page が指定されている大問はその指定を尊重
 * - 未指定の大問は、A4用紙1枚の容量（1ページ目: 8.0, 2ページ目以降: 10.0）を超えたら自動で次ページに送る
 */
export function resolveSectionPages(sections: TestSection[]): { section: TestSection; secIdx: number; page: number }[] {
  let currentPage = 1;
  let currentPageWeight = 0;

  return sections.map((section, secIdx) => {
    const secWeight = calculateSectionWeight(section);

    // 手動でページ指定がある場合
    if (typeof section.page === "number" && section.page >= 1) {
      currentPage = section.page;
      currentPageWeight = secWeight;
      return { section, secIdx, page: currentPage };
    }

    // 自動判定: 1ページ目はヘッダーがあるため約8.0、2ページ目以降は約10.0が上限
    const pageCapacity = currentPage === 1 ? 8.0 : 10.0;

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
 * ページ番号ごとに大問をグループ化して返す
 */
export function groupSectionsByPage(sections: TestSection[]): Map<number, { section: TestSection; secIdx: number }[]> {
  const resolved = resolveSectionPages(sections);
  const pageMap = new Map<number, { section: TestSection; secIdx: number }[]>();

  // 常に最低でもページ1は存在させる
  pageMap.set(1, []);

  resolved.forEach(item => {
    const list = pageMap.get(item.page) || [];
    list.push({ section: item.section, secIdx: item.secIdx });
    pageMap.set(item.page, list);
  });

  return pageMap;
}

/**
 * 全大問中の最大ページ番号を取得（最低1）
 */
export function getMaxPageNumber(sections: TestSection[]): number {
  const resolved = resolveSectionPages(sections);
  let max = 1;
  resolved.forEach(item => {
    if (item.page > max) max = item.page;
  });
  return max;
}
