/**
 * 小問アイテム（箇条書き空所、(1)〜(n)、（１）〜（ｎ）、①〜(n)など）の自動検出・動的リナンバリングユーティリティ
 */

// 丸数字マッピング (1〜20)
export const CIRCLED_NUMBERS = [
  "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
  "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"
];

// 全角括弧数字マッピング (1〜20)
export const FULL_PAREN_NUMBERS = [
  "（１）", "（２）", "（３）", "（４）", "（５）",
  "（６）", "（７）", "（８）", "（９）", "（１０）",
  "（１１）", "（１２）", "（１３）", "（１４）", "（１５）",
  "（１６）", "（１７）", "（１８）", "（１９）", "（２０）"
];

export type SubItemLabelType = "circled" | "paren" | "fullParen" | "bracket" | "plain";

export interface ParsedSubItem {
  index: number;              // 0-indexed (元の並び順: 0, 1, 2...)
  rawLine: string;            // 元の行全体
  originalNumber: number;     // 元の番号 (1, 2, 3...)
  originalLabel: string;      // "①", "(1)", "（１）", "1." 等
  labelType: SubItemLabelType;
  promptText: string;         // 問題内容部分
  answerText?: string;        // 対応する模範解答
  explanationText?: string;   // 対応する解説
}

export interface ParseSubItemsResult {
  hasSubItems: boolean;
  leadInText: string;         // 導入文・指示文
  items: ParsedSubItem[];
  labelType: SubItemLabelType;
}

/**
 * 全角数字を半角数字に変換
 */
export function toHalfWidthNumber(str: string): string {
  return str.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 半角数字を全角数字に変換
 */
export function toFullWidthNumber(num: number | string): string {
  return String(num).replace(/[0-9]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
}

/**
 * 文字列中のエスケープされた \n や改行コードを正規化
 */
export function normalizeNewlines(str: string): string {
  if (!str) return "";
  return str.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n|\r/g, "\n");
}

/**
 * 番号から対応するラベル文字列を生成
 */
export function formatSubLabel(num: number, labelType: SubItemLabelType): string {
  if (labelType === "circled") {
    if (num >= 1 && num <= 20) {
      return CIRCLED_NUMBERS[num - 1];
    }
    return `(${num})`;
  }
  if (labelType === "fullParen") {
    if (num >= 1 && num <= 20) {
      return FULL_PAREN_NUMBERS[num - 1];
    }
    return `（${toFullWidthNumber(num)}）`;
  }
  if (labelType === "paren") {
    return `(${num})`;
  }
  if (labelType === "bracket") {
    return `[${num}]`;
  }
  return `${num}.`;
}

/**
 * 正規表現にマッチするすべての結果を安全に取得（matchAllとトランスパイルの互換性問題を完全回避）
 */
function getAllMatches(regex: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(m);
  }
  return matches;
}

/**
 * 解答文字列（a）を小問ごとに分割してマッピング
 */
function parseAnswerBySubItems(answerStr: string, totalItems: number): Map<number, string> {
  const map = new Map<number, string>();
  if (!answerStr) return map;

  const normalized = normalizeNewlines(answerStr);
  const lines = normalized.split("\n").map(l => l.trim()).filter(Boolean);

  // パターンA: 改行ごとに小問がある場合
  if (lines.length >= 2) {
    lines.forEach((line, idx) => {
      // (1) や （１） などの記号を取り除く
      const clean = line.replace(/^\s*(?:[（\(][0-9０-９]+[）\)]|\[[0-9]+\]|[①-⑳]|[0-9]+[\.．\s])\s*/, "");
      map.set(idx, clean || line);
    });
    return map;
  }

  // パターンB: 1行の中に ① ... ② ... または (1) ... (2) ... / （１）... が並んでいる場合
  // 1. 丸数字での分割
  const circledMatches = getAllMatches(/([①-⑳])\s*([^\s①-⑳]+(?:(?!\s*[①-⑳]).)*)/g, normalized);
  if (circledMatches.length >= 2) {
    circledMatches.forEach(m => {
      const char = m[1];
      const val = m[2].trim();
      const num = CIRCLED_NUMBERS.indexOf(char) + 1;
      if (num > 0) {
        map.set(num - 1, val);
      }
    });
    return map;
  }

  // 2. 括弧数字 (1) ... (2) ... または （１）...（２）... での分割
  const parenMatches = getAllMatches(/[（\(]([0-9０-９]+)[）\)]\s*([^\(（\n]+(?:(?!\s*[（\(][0-9０-９]+[）\)]).)*)/g, normalized);
  if (parenMatches.length >= 2) {
    parenMatches.forEach(m => {
      const num = parseInt(toHalfWidthNumber(m[1]), 10);
      const val = m[2].trim();
      if (num > 0) {
        map.set(num - 1, val);
      }
    });
    return map;
  }

  return map;
}

/**
 * 1行の中にインラインで (1) ... (2) ... または （１）... （２）... が含まれている場合に複数行へ分割
 */
function splitInlineSubItems(text: string): string[] {
  const norm = normalizeNewlines(text);
  const rawLines = norm.split("\n");
  const resultLines: string[] = [];

  // 範囲表記（例: (1)-(14), (1)〜(5), （１）〜（３）, (1) to (14) 等）を保護
  // また、文中の空所記号（例: ( ① ), （ ① ）, [ ① ]）も小問分割境界と誤認しないよう保護
  const subItemRegex = /(?<![〜～\-–—－−ー―\w]\s*)(?:[（\(]([0-9０-９]+)[）\)]|(?<![（\(\[]\s*)([①-⑳])(?!\s*[）\)\]]))(?!\s*(?:[〜～\-–—－−ー―]|to\b))/gi;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 行内に2つ以上の独立した小問記号があるかチェック
    const matches = getAllMatches(subItemRegex, trimmed);
    if (matches.length >= 2) {
      // 導入部（最初の小問記号より前）
      const firstIndex = matches[0].index ?? 0;
      if (firstIndex > 0) {
        const lead = trimmed.substring(0, firstIndex).trim();
        if (lead) resultLines.push(lead);
      }

      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        const start = currentMatch.index ?? 0;
        const end = nextMatch ? (nextMatch.index ?? trimmed.length) : trimmed.length;
        const itemStr = trimmed.substring(start, end).trim();
        if (itemStr) resultLines.push(itemStr);
      }
      continue;
    }

    resultLines.push(trimmed);
  }

  return resultLines;
}

/**
 * 問題文から小問（箇条書き空所、(1)〜、(１)〜、①〜など）を自動解析
 */
export function parseSubItems(
  questionText: string,
  answerText: string = "",
  explanationText: string = "",
  disabled?: boolean
): ParseSubItemsResult {
  if (!questionText || disabled) {
    return { hasSubItems: false, leadInText: questionText || "", items: [], labelType: "paren" };
  }

  // 改行コード正規化およびインライン小問の行分割
  const rawLines = splitInlineSubItems(questionText);
  const items: ParsedSubItem[] = [];

  // 解答を小問ごとに分解
  const answerMap = parseAnswerBySubItems(answerText, rawLines.length);

  let detectedType: SubItemLabelType = "paren";
  const nonItemLines: string[] = [];
  let foundFirstItem = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // 【最優先】パターンA: 行頭が (1) や (2) または （１） や （２）、箇条書き付き ・(1) も含む
    // 例: "(1) store / shop: ( 1 )" や "(1) 彼は私の兄よりも若いです。" または "（１）$a=b$ ならば..."
    const parenStartMatch = line.match(/^[・\-\*]?\s*([（\(])([0-9０-９]+)[）\)]\s*(.+)$/);
    if (parenStartMatch) {
      foundFirstItem = true;
      const bracketChar = parenStartMatch[1];
      const isFull = bracketChar === "（" || /[０-９]/.test(parenStartMatch[2]);
      if (items.length === 0) {
        detectedType = isFull ? "fullParen" : "paren";
      }
      const num = parseInt(toHalfWidthNumber(parenStartMatch[2]), 10);
      const label = isFull ? `（${toFullWidthNumber(num)}）` : `(${num})`;
      items.push({
        index: items.length,
        rawLine: line,
        originalNumber: num,
        originalLabel: label,
        labelType: isFull ? "fullParen" : "paren",
        promptText: parenStartMatch[3].trim(),
        answerText: answerMap.get(items.length) || answerMap.get(num - 1)
      });
      continue;
    }

    // 【優先】パターンB: 行頭が ① や ②、箇条書き付き ・① も含む
    const circledStartMatch = line.match(/^[・\-\*]?\s*([①-⑳])\s*(.+)$/);
    if (circledStartMatch) {
      foundFirstItem = true;
      detectedType = "circled";
      const char = circledStartMatch[1];
      const num = CIRCLED_NUMBERS.indexOf(char) + 1;
      items.push({
        index: items.length,
        rawLine: line,
        originalNumber: num > 0 ? num : items.length + 1,
        originalLabel: char,
        labelType: "circled",
        promptText: circledStartMatch[2].trim(),
        answerText: answerMap.get(items.length) || answerMap.get((num > 0 ? num : items.length + 1) - 1)
      });
      continue;
    }

    // パターンC: 箇条書き内の空所 ( ① ) や （ ① ）
    // 例: "・店、商店：( ① )" や "・郵便、郵便箱：( ② )"
    const bulletCircledMatch = line.match(/^[・\-\*]?\s*(.*?)[：:]\s*[（\(]\s*([①-⑳])\s*[）\)](.*)$/);
    if (bulletCircledMatch) {
      foundFirstItem = true;
      detectedType = "circled";
      const circledChar = bulletCircledMatch[2];
      const num = CIRCLED_NUMBERS.indexOf(circledChar) + 1;
      items.push({
        index: items.length,
        rawLine: line,
        originalNumber: num > 0 ? num : items.length + 1,
        originalLabel: circledChar,
        labelType: "circled",
        promptText: line,
        answerText: answerMap.get(items.length) || answerMap.get((num > 0 ? num : items.length + 1) - 1)
      });
      continue;
    }

    // パターンD: 箇条書き内の数字空所（行頭に番号がない語句穴埋めなど）
    // 例: "・語句：( 1 )" や "・空所：( (1) )"
    const bulletParenMatch = line.match(/^[・\-\*]?\s*(.*?)[：:]\s*[（\(]\s*([0-9０-９]+)\s*[）\)](.*)$/);
    if (bulletParenMatch) {
      foundFirstItem = true;
      const isFull = line.includes("（") || /[０-９]/.test(bulletParenMatch[2]);
      detectedType = isFull ? "fullParen" : "paren";
      const num = parseInt(toHalfWidthNumber(bulletParenMatch[2]), 10);
      const label = isFull ? `（${toFullWidthNumber(num)}）` : `(${num})`;
      items.push({
        index: items.length,
        rawLine: line,
        originalNumber: num,
        originalLabel: label,
        labelType: detectedType,
        promptText: line,
        answerText: answerMap.get(items.length) || answerMap.get(num - 1)
      });
      continue;
    }

    // 小問より前にある行は「導入文」
    if (!foundFirstItem) {
      nonItemLines.push(line);
    } else {
      // 小問の途中で継続行（複数行にまたがる小問文など）がある場合
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        lastItem.promptText += "\n" + line;
        lastItem.rawLine += "\n" + line;
      }
    }
  }

  return {
    hasSubItems: items.length >= 2,
    leadInText: nonItemLines.join("\n"),
    items,
    labelType: detectedType
  };
}

/**
 * 導入文の中にある「(1)〜(10)」や「（１）〜（１０）」「①〜⑭」のような範囲表記を選択数に応じて自動補正
 */
export function updateLeadInRangeText(leadInText: string, selectedCount: number, labelType: SubItemLabelType): string {
  if (!leadInText || selectedCount <= 0) return leadInText;

  // 例: （１）〜（１０） 全角
  const fullParenRangeRegex = /（[0-9０-９]+）\s*[〜～\-–]\s*（[0-9０-９]+）/g;
  let updated = leadInText.replace(fullParenRangeRegex, `（１）〜（${toFullWidthNumber(selectedCount)}）`);

  // 例: (1)〜(10) 半角
  const parenRangeRegex = /\([0-9０-９]+\)\s*[〜～\-–]\s*\([0-9０-９]+\)/g;
  updated = updated.replace(parenRangeRegex, `(1)〜(${selectedCount})`);

  // 例: ①〜⑩ や ①～⑭
  const circledRangeRegex = /[①-⑳]\s*[〜～\-–]\s*[①-⑳]/g;
  const targetCircledEnd = selectedCount <= 20 ? CIRCLED_NUMBERS[selectedCount - 1] : `(${selectedCount})`;
  updated = updated.replace(circledRangeRegex, `①〜${targetCircledEnd}`);

  // 例: 直線(1)〜(4) や 空所(1)〜(10)
  updated = updated.replace(/(直線|空所|問題|設問|下線部|次)?([（\(][0-9０-９]+[）\)])\s*[〜～\-–]\s*([（\(][0-9０-９]+[）\)])/g, (match, prefix) => {
    const p = prefix || "";
    if (labelType === "fullParen") {
      return `${p}（１）〜（${toFullWidthNumber(selectedCount)}）`;
    }
    return `${p}(1)〜(${selectedCount})`;
  });

  return updated;
}

/**
 * 選択された小問のみを抽出し、1から始まる新番号で問題文・解答・解答欄ラベルを動的リナンバリング再構成
 */
export function reconstructQuestionWithSelectedSubItems(
  leadInText: string,
  allItems: ParsedSubItem[],
  selectedIndices: number[],
  labelType: SubItemLabelType
): {
  newQuestionText: string;
  newAnswer: string;
  newExplanation?: string;
  newAnswerLabels: string[];
} {
  // 有効なインデックスのみ抽出してソート
  const validIndices = selectedIndices
    .filter(idx => idx >= 0 && idx < allItems.length)
    .sort((a, b) => a - b);

  const selectedCount = validIndices.length;

  // 導入文の範囲表記を更新
  const updatedLeadIn = updateLeadInRangeText(leadInText, selectedCount, labelType);

  const newQuestionLines: string[] = [];
  if (updatedLeadIn) {
    newQuestionLines.push(updatedLeadIn);
  }

  const newAnswerParts: string[] = [];
  const newAnswerLabels: string[] = [];

  validIndices.forEach((origIdx, seqIdx) => {
    const item = allItems[origIdx];
    const newNum = seqIdx + 1;
    const newLabel = formatSubLabel(newNum, labelType);
    newAnswerLabels.push(newLabel);

    // プロンプト本文を基準に新しい行を構築
    let newLine = "";

    // 元の行が箇条書き空所型（行頭に(1)等の番号がなく、文中に空所がある）かどうか判定
    const isBulletBlank = !item.rawLine.match(/^[・\-\*]?\s*(?:[（\(][0-9０-９]+[）\)]|[①-⑳]|[0-9]+[\.．])/) &&
      (item.rawLine.match(/[（\(]\s*[①-⑳]\s*[）\)]/) || item.rawLine.match(/^[・\-\*]?\s*(.*?)[：:]\s*[（\(]\s*[0-9０-９]+\s*[）\)]/));

    if (isBulletBlank) {
      // 箇条書き空所型: promptText 内の空所記号を新番号に置換
      newLine = item.promptText || item.rawLine;
      if (newLine.match(/[（\(]\s*[①-⑳]\s*[）\)]/)) {
        newLine = newLine.replace(/[（\(]\s*[①-⑳]\s*[）\)]/, `( ${newLabel} )`);
      } else if (newLine.match(/([（\(]\s*)[0-9０-９]+(\s*[）\)])/)) {
        const numPart = labelType === "fullParen" ? toFullWidthNumber(newNum) : String(newNum);
        newLine = newLine.replace(/([（\(]\s*)[0-9０-９]+(\s*[）\)])/, `$1${numPart}$2`);
      }
    } else {
      // 行頭番号型または通常小問
      const prefixBullet = item.rawLine.startsWith("・") ? "・" : "";
      let cleanPrompt = (item.promptText || "").trim();

      // promptText の行頭にもし重複して旧ラベルや新ラベルが付いていれば除去
      cleanPrompt = cleanPrompt.replace(/^(?:[（\(][0-9０-９]+[）\)]|[①-⑳]|[0-9]+[\.．])\s*/, "");

      // promptText 内に旧番号と一致する空所がある場合（例: ": ( 3 )" や ": ( ③ )"）は新番号に連動置換
      const origNum = item.originalNumber;
      if (origNum && origNum > 0) {
        // ( 3 ) または (3) または （３）
        const origNumPattern = new RegExp(`([（\\(]\\s*)${origNum}(\\s*[）\\)])`, "g");
        const newNumPart = labelType === "fullParen" ? toFullWidthNumber(newNum) : String(newNum);
        cleanPrompt = cleanPrompt.replace(origNumPattern, `$1${newNumPart}$2`);

        // 丸数字 ③
        if (origNum <= 20) {
          const origCircled = CIRCLED_NUMBERS[origNum - 1];
          const newCircled = newNum <= 20 ? CIRCLED_NUMBERS[newNum - 1] : `(${newNum})`;
          cleanPrompt = cleanPrompt.replaceAll(origCircled, newCircled);
        }
      }

      newLine = `${prefixBullet}${newLabel} ${cleanPrompt}`;
    }

    newQuestionLines.push(newLine);

    // 解答の再構成
    if (item.answerText) {
      newAnswerParts.push(`${newLabel} ${item.answerText}`);
    }
  });

  const newQuestionText = newQuestionLines.join("\n");
  const newAnswer = newAnswerParts.join(" ");

  return {
    newQuestionText,
    newAnswer,
    newAnswerLabels
  };
}
