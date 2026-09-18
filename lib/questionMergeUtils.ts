import { Question } from "@/types/quiz";
import {
  parseSubItems,
  formatSubLabel,
  toFullWidthNumber,
  SubItemLabelType,
  updateLeadInRangeText,
  normalizeNewlines
} from "./subItemUtils";

interface ExtractedSubItem {
  promptText: string;
  rawLine: string;
  answerText: string;
  explanationText?: string;
  isBulletBlank: boolean; // "・billion：( ① )" のように文中に空所記号があるタイプか
  isSelected: boolean;    // マージ前の元問題で選択されていたか（カットされていないか）
}

function buildQuestionLinesAndAnswer(
  items: ExtractedSubItem[],
  commonLeadIn: string,
  detectedType: SubItemLabelType
) {
  const totalCount = items.length;
  const newQuestionLines: string[] = [];
  const newAnswerParts: string[] = [];
  const newAnswerLabels: string[] = [];

  if (commonLeadIn) {
    const updatedLeadIn = updateLeadInRangeText(commonLeadIn, totalCount, detectedType);
    newQuestionLines.push(updatedLeadIn);
  }

  items.forEach((item, idx) => {
    const seqNum = idx + 1;
    const newLabel = formatSubLabel(seqNum, detectedType);
    newAnswerLabels.push(newLabel);

    let newLine = "";

    if (item.isBulletBlank) {
      let text = item.promptText || item.rawLine;
      if (text.match(/[（\(]\s*[①-⑳]\s*[）\)]/)) {
        text = text.replace(/[（\(]\s*[①-⑳]\s*[）\)]/, `( ${newLabel} )`);
      } else if (text.match(/[（\(]\s*[0-9０-９]+\s*[）\)]/)) {
        const numStr = detectedType === "fullParen" ? toFullWidthNumber(seqNum) : String(seqNum);
        text = text.replace(/([（\(]\s*)[0-9０-９]+(\s*[）\)])/, `$1${numStr}$2`);
      } else {
        text = `${text} ( ${newLabel} )`;
      }
      newLine = text;
    } else {
      let cleanPrompt = item.promptText || item.rawLine;
      cleanPrompt = cleanPrompt.replace(/^[・\-\*]?\s*(?:[（\(][0-9０-９]+[）\)]|[①-⑳]|[0-9]+[\.．])\s*/, "").trim();
      const prefixBullet = (item.rawLine.startsWith("・") && !cleanPrompt.startsWith("・")) ? "・" : "";
      newLine = `${prefixBullet}${newLabel} ${cleanPrompt}`;
    }

    newQuestionLines.push(newLine);

    let cleanAns = item.answerText.trim();
    cleanAns = cleanAns.replace(/^(?:[（\(][0-9０-９]+[）\)]|[①-⑳]|[0-9]+[\.．]|\(?\d+\)?)\s*/, "").trim();
    if (cleanAns) {
      newAnswerParts.push(`${newLabel} ${cleanAns}`);
    }
  });

  return {
    questionText: newQuestionLines.join("\n"),
    answer: newAnswerParts.join(" "),
    answerLabels: newAnswerLabels
  };
}

/**
 * 複数のQuestionを1つのQuestionにマージし、問題番号（(1)〜 や ①〜 など）を連番に振り直す
 * カット（非表示）された枝問も破棄せず保持し、マージ後も枝問編集で後から追加・復元可能
 * 元のQuestion配列は mergedQuestions に保存され、非破壊でいつでも復元可能
 */
export function mergeQuestions(questions: Question[]): Question {
  if (!questions || questions.length === 0) {
    throw new Error("No questions to merge");
  }
  if (questions.length === 1) {
    return questions[0];
  }

  // 1. ラベルタイプの決定（丸数字 ① が1つでも含まれていれば circled、全角括弧なら fullParen、それ以外は paren）
  let detectedType: SubItemLabelType = "paren";
  let hasCircled = false;
  let hasFullParen = false;

  for (const q of questions) {
    const text = (q.originalQuestionText || q.questionText || "") + " " + (q.originalAnswer || q.answer || "");
    if (/[①-⑳]/.test(text)) {
      hasCircled = true;
      break;
    }
    if (/[（][0-9０-９]+[）]/.test(text) || /[０-９]/.test(text)) {
      hasFullParen = true;
    }
  }

  if (hasCircled) {
    detectedType = "circled";
  } else if (hasFullParen) {
    detectedType = "fullParen";
  } else {
    detectedType = "paren";
  }

  // 2. 各Questionから小問アイテムを抽出（カットされた非表示の枝問も漏れなく抽出）
  const allItems: ExtractedSubItem[] = [];
  let commonLeadIn: string = "";
  let hasAnyCutItems = false;

  for (const q of questions) {
    // カット前のオリジナルテキストがあれば優先、なければ現在のテキスト
    const sourceQText = q.originalQuestionText || q.questionText;
    const sourceAns = q.originalAnswer || q.answer;
    const sourceExp = q.originalExplanation || q.explanation;

    const parsed = parseSubItems(sourceQText, sourceAns, sourceExp);

    if (parsed.hasSubItems && parsed.items.length > 0) {
      if (!commonLeadIn && parsed.leadInText) {
        commonLeadIn = parsed.leadInText;
      }

      // この問題で選択されている枝問のインデックス（未設定時は全問選択）
      const qSelected = (q.selectedSubItemIndices && q.selectedSubItemIndices.length > 0)
        ? q.selectedSubItemIndices
        : parsed.items.map((_, i) => i);

      if (qSelected.length < parsed.items.length) {
        hasAnyCutItems = true;
      }

      for (let itemIdx = 0; itemIdx < parsed.items.length; itemIdx++) {
        const item = parsed.items[itemIdx];
        const isBulletBlank = Boolean(
          item.rawLine.match(/[（\(]\s*[①-⑳0-9０-９]+\s*[）\)]/) &&
          (item.rawLine.includes("：") || item.rawLine.includes(":") || item.rawLine.startsWith("・"))
        );
        const isSelected = qSelected.includes(itemIdx);

        allItems.push({
          promptText: item.promptText || item.rawLine,
          rawLine: item.rawLine,
          answerText: item.answerText || "",
          explanationText: item.explanationText,
          isBulletBlank,
          isSelected
        });
      }
    } else {
      // 単一問題の場合
      const normQ = normalizeNewlines(sourceQText).trim();
      const normA = (sourceAns || "").trim();

      const isBulletBlank = Boolean(
        normQ.match(/[（\(]\s*[①-⑳0-9０-９]+\s*[）\)]/) &&
        (normQ.includes("：") || normQ.includes(":") || normQ.startsWith("・"))
      );

      allItems.push({
        promptText: normQ,
        rawLine: normQ,
        answerText: normA,
        explanationText: sourceExp,
        isBulletBlank,
        isSelected: true
      });
    }
  }

  // 3. 全小問を含む完全版（Master）の構築（非表示・カットされた小問も含めて1〜N連番）
  const master = buildQuestionLinesAndAnswer(allItems, commonLeadIn, detectedType);

  // マージ後の全小問のうち、選択されている小問のグローバルインデックス配列
  const mergedSelectedIndices: number[] = [];
  allItems.forEach((it, idx) => {
    if (it.isSelected) {
      mergedSelectedIndices.push(idx);
    }
  });

  // 4. 現在出題される版（Current）の構築
  // カットされた小問がある場合は選択小問のみ抽出して1〜M連番にリナンバリング、なければMasterと同一
  const current = hasAnyCutItems
    ? buildQuestionLinesAndAnswer(allItems.filter(it => it.isSelected), commonLeadIn, detectedType)
    : master;

  // 5. その他のメタ情報合算
  const baseQ = questions[0];
  const totalPoints = questions.reduce((sum, q) => sum + (q.defaultPoints || 0), 0);
  const totalSeconds = questions.reduce((sum, q) => sum + (q.estimatedSeconds || 0), 0);
  const explanations = questions
    .map(q => (q.originalExplanation || q.explanation)?.trim())
    .filter((e): e is string => Boolean(e && e.length > 0));

  const mergedQuestion: Question = {
    ...baseQ,
    id: `merged_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questionText: current.questionText,
    answer: current.answer,
    answerLabels: current.answerLabels,
    originalQuestionText: master.questionText, // 非表示・カット枝問を含む全小問テキスト（枝問編集で後から追加可能）
    originalAnswer: master.answer,             // 全模範解答
    originalExplanation: Array.from(new Set(explanations)).join("\n"),
    selectedSubItemIndices: hasAnyCutItems ? mergedSelectedIndices : undefined,
    explanation: Array.from(new Set(explanations)).join("\n"),
    defaultPoints: totalPoints || baseQ.defaultPoints,
    estimatedSeconds: totalSeconds || baseQ.estimatedSeconds,
    mergedQuestions: questions // 元の全Questionを保存（非破壊復元用）
  };

  return mergedQuestion;
}

/**
 * マージされたQuestionを元のQuestion配列に復元する
 */
export function unmergeQuestion(question: Question): Question[] {
  if (question.mergedQuestions && question.mergedQuestions.length > 0) {
    return question.mergedQuestions;
  }
  return [question];
}
