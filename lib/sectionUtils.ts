import { Question } from "@/types/quiz";

/**
 * 半角数字を全角数字に変換（例: 1 -> １, 2 -> ２）
 */
function toFullWidthDigits(num: number): string {
  return String(num).replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

/**
 * 大問に含まれる問題の論点（メイン単元 topic / サブ論点 subTopic）から大問の題名を自動生成
 * 例:
 *  - "大問１　平面図形（円周角の定理・三平方）"
 *  - "大問１　1次関数（1次関数の意味・式の識別）"
 *  - "大問２　変化の割合と増加量（変化の割合・変域）"
 * 
 * ※ 大問と論点の間は視認性を保つため「全角スペース（　）」で区切ります。
 */
export function generateSectionTitleFromQuestions(secIndex: number, questions: Question[]): string {
  const fullNum = toFullWidthDigits(secIndex + 1);
  const prefix = `大問${fullNum}`;
  if (!questions || questions.length === 0) {
    return prefix;
  }

  // 1. メイン単元（topic）の重複排除リスト
  const topics = Array.from(
    new Set(
      questions
        .map(q => q.topic?.trim())
        .filter((t): t is string => Boolean(t))
    )
  );

  // 2. サブ論点（subTopic）の重複排除リスト
  const subTopics = Array.from(
    new Set(
      questions
        .map(q => q.subTopic?.trim())
        .filter((st): st is string => Boolean(st))
    )
  );

  const mainTopicStr = topics.slice(0, 2).join("・");
  const subTopicStr = subTopics.slice(0, 3).join("・");

  if (mainTopicStr && subTopicStr) {
    return `${prefix}　${mainTopicStr}（${subTopicStr}）`;
  } else if (mainTopicStr) {
    return `${prefix}　${mainTopicStr}`;
  } else if (subTopicStr) {
    return `${prefix}　（${subTopicStr}）`;
  }

  return prefix;
}
