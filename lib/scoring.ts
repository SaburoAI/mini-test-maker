import { TestSection } from "@/types/quiz";

/**
 * テスト全体の設問に対して、合計100点になるように均等に配点（余りは均等配分）する
 */
export function recalculateTestScores(sections: TestSection[], targetTotal = 100): TestSection[] {
  // 全設問数をカウント
  let totalQuestionsCount = 0;
  sections.forEach(sec => {
    totalQuestionsCount += sec.questions.length;
  });

  if (totalQuestionsCount === 0) {
    return sections;
  }

  const basePoint = Math.floor(targetTotal / totalQuestionsCount);
  let remainder = targetTotal % totalQuestionsCount;

  return sections.map(sec => ({
    ...sec,
    questions: sec.questions.map(q => {
      let pt = basePoint;
      if (remainder > 0) {
        pt += 1;
        remainder -= 1;
      }
      return {
        ...q,
        defaultPoints: pt
      };
    })
  }));
}

/**
 * 現在のテストの合計点数を算出
 */
export function calculateCurrentTotal(sections: TestSection[]): number {
  return sections.reduce((acc, sec) => {
    return acc + sec.questions.reduce((qAcc, q) => qAcc + (q.defaultPoints || 0), 0);
  }, 0);
}
