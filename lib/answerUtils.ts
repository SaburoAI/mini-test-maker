/**
 * 解答・問題文から小問ラベル（(1), (2) や ①, ②、および「yの値」「xの増加量」等）を自動検出するユーティリティ
 */

/**
 * questionText および answer、または明示的な answerLabels を解析し、
 * 解答欄に分割表示すべきラベルの配列を抽出する
 * 
 * 優先順位:
 *  1. customLabels があれば最優先
 *  2. カッコ数字 (1), (2)...
 *  3. 丸数字 ①, ②...
 *  4. カッコカナ (ア), (イ)...
 *  5. 問題文中の並列要求（「対応する y の値、および x の増加量と y の増加量をそれぞれ求めなさい」等）
 *  6. answer 内の角括弧ラベル [xxx]
 *  7. answer 内のコロン区切りラベル xxx:
 */
export function extractSubQuestionLabels(
  questionText: string,
  answer: string = "",
  customLabels?: string[]
): string[] {
  // 1. 明示的なカスタムラベル（Mini-JSONの al や Question の answerLabels）
  if (customLabels && customLabels.length > 0) {
    return customLabels.map(l => l.trim()).filter(Boolean);
  }

  const normQ = questionText || "";
  const normA = answer || "";

  // 2. カッコ数字（(1), (2)... または （１）, （２）...）の検出
  const extractParenDigits = (text: string): string[] => {
    const regex = /(?:(?<=\s|^|\n)|(?<=[^\w]))(?:\(|\（)(\d{1,2})(?:\)|\）)/g;
    const numbers: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    if (numbers.length >= 2) {
      const uniqueNumbers = Array.from(new Set(numbers));
      if (uniqueNumbers.length >= 2) {
        const isSequential = uniqueNumbers.every((val, i) => i === 0 || val === uniqueNumbers[i - 1] + 1);
        if (isSequential) {
          return uniqueNumbers.map(n => `(${n})`);
        }
      }
    }
    return [];
  };

  const ansParen = extractParenDigits(normA);
  if (ansParen.length >= 2) return ansParen;

  const qParen = extractParenDigits(normQ);
  if (qParen.length >= 2) return qParen;

  // 3. answer / questionText 内の丸数字（①, ②, ...）の検出
  const ansCircleMatches = normA.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g);
  if (ansCircleMatches && ansCircleMatches.length >= 2) {
    const uniqueCircles = Array.from(new Set(ansCircleMatches));
    if (uniqueCircles.length >= 2) {
      return uniqueCircles;
    }
  }

  const qCircleMatches = normQ.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g);
  if (qCircleMatches && qCircleMatches.length >= 2) {
    const uniqueCircles = Array.from(new Set(qCircleMatches));
    if (uniqueCircles.length >= 2) {
      return uniqueCircles;
    }
  }

  // 4. カッコカナ（(ア), (イ)...）の検出
  const extractParenKana = (text: string): string[] => {
    const regex = /(?:(?<=\s|^|\n)|(?<=[^\w]))(?:\(|\（)([アイウエオカキクケコサシスセソ])(?:\)|\）)/g;
    const foundKana: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      foundKana.push(match[1]);
    }
    if (foundKana.length >= 2) {
      const uniqueKana = Array.from(new Set(foundKana));
      if (uniqueKana.length >= 2) {
        return uniqueKana.map(k => `(${k})`);
      }
    }
    return [];
  };

  const ansKana = extractParenKana(normA);
  if (ansKana.length >= 2) return ansKana;

  const qKana = extractParenKana(normQ);
  if (qKana.length >= 2) return qKana;

  // 5. questionText 内の「〜それぞれ求めなさい / それぞれ答えなさい」からの並列要求抽出
  // 例: "関数 y=3x+1 において、x の値が 1 から 5 まで変化するとき、対応する y の値、および x の増加量と y の増加量をそれぞれ求めなさい。"
  const cleanQ = normQ.replace(/\[cite:\s*\d+\]/g, "").replace(/\$/g, "");
  const eachMatch = cleanQ.match(/(.+?)(?:を|の値を)?それぞれ(?:求め|答え|いい|書き|計算し)なさい/);
  if (eachMatch) {
    const targetPhrase = eachMatch[1].trim();
    const conditionSplits = targetPhrase.split(/(?:とき|において|について)[、,]?\s*/);
    const clause = conditionSplits[conditionSplits.length - 1];
    
    const splitTokens = clause
      .split(/(?:、?\s*および\s*|\s*と\s*)/)
      .map(t => t.trim().replace(/^、/, "").trim())
      .filter(t => t.length > 0 && t.length <= 15 && !["を", "の値を", "それぞれ"].includes(t));

    if (splitTokens.length >= 2) {
      return splitTokens;
    }
  }

  // 6. answer 内の角括弧 [xxx] の検出（※ [cite: 3] や英語の別解除外のため、行頭・空白後・コロン付き等を考慮）
  const bracketMatches: string[] = [];
  const bRegex = /(?:^|[\n、,/\s])\[([^\[\]]{1,15})\]/g;
  let bm: RegExpExecArray | null;
  while ((bm = bRegex.exec(normA)) !== null) {
    const content = bm[1].trim();
    if (!content.startsWith("cite:") && !content.includes(" ")) {
      bracketMatches.push(content);
    }
  }
  if (bracketMatches.length >= 2) {
    return Array.from(new Set(bracketMatches));
  }

  // 7. answer 内のコロン区切り項目名（例: "yの値: 4から16, xの増加量: 4, yの増加量: 12"）
  const colonLabels: string[] = [];
  const cRegex = /(?:^|[、,/\n])\s*([^:：\n\(\)\[\]]{1,15})\s*[:：]/g;
  let cm: RegExpExecArray | null;
  while ((cm = cRegex.exec(normA)) !== null) {
    const lbl = cm[1].replace(/[\$]/g, "").trim();
    if (lbl && !colonLabels.includes(lbl)) {
      colonLabels.push(lbl);
    }
  }
  if (colonLabels.length >= 2) {
    return colonLabels;
  }

  return [];
}

/**
 * ラベルが記号（(1) や ① など）か、通常のテキスト（例: "yの値", "xの増加量"）かを判定
 */
export function isSymbolLabel(label: string): boolean {
  if (!label) return false;
  const trimmed = label.trim();
  // 丸数字、カッコ数字、カッコカナ
  return (
    /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]$/.test(trimmed) ||
    /^\(?\d{1,2}\)?$/.test(trimmed) ||
    /^\(?[ア-ンa-zA-Z]\)?$/.test(trimmed)
  );
}

/**
 * 解答文字列から小問ラベルごとの解答テキストを抽出する
 */
export function extractSubQuestionAnswerMap(
  answer: string = "",
  subLabels: string[] = []
): Map<string, string> {
  const map = new Map<string, string>();
  if (!answer || subLabels.length === 0) return map;

  const normA = answer.replace(/\\n/g, "\n").trim();
  const lines = normA.split("\n").map(l => l.trim()).filter(Boolean);

  // 改行区切りで小問ラベルと同数ある場合
  if (lines.length === subLabels.length) {
    subLabels.forEach((lbl, idx) => {
      const line = lines[idx];
      // 行頭のラベル部分を除去
      const clean = line.replace(/^\s*(?:[（\(][0-9０-９]+[）\)]|\[[^\]]+\]|[①-⑳]|[0-9]+[\.．\s]|[^:：]{1,15}[:：])\s*/, "");
      map.set(lbl, clean || line);
    });
    return map;
  }

  // 1行の中にラベルが並んでいる場合（例: "(1) 店 (2) 郵便" や "① 2 ② 4" や "yの値: 4から16"）
  subLabels.forEach((lbl, idx) => {
    // lbl のエスケープ
    const escapedLbl = lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextLbl = subLabels[idx + 1];
    const escapedNext = nextLbl ? nextLbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;

    // パターン1: "(1) 解答 (2)" または "[yの値] 解答 [xの増加量]"
    const patternStr = escapedNext
      ? `${escapedLbl}\\s*[:：]?\\s*([\\s\\S]*?)(?=${escapedNext}|$)`
      : `${escapedLbl}\\s*[:：]?\\s*([\\s\\S]*)`;

    try {
      const regex = new RegExp(patternStr);
      const match = normA.match(regex);
      if (match && match[1]) {
        map.set(lbl, match[1].trim());
      }
    } catch {
      // 正規表現エラー時はフォールバック
    }
  });

  return map;
}

/**
 * 解答の文字数（および小問数・ラベル長）に応じて動的に下線幅（px）を計算
 * - 文字数が長い解答（英単語や数式など）には十分な記入幅を確保
 * - 小さすぎた固定幅を底上げし、シャーペンで書き込めるゆったりサイズに動的調整
 */
export function calculateSubQuestionLineWidth(
  answerText: string = "",
  totalCount: number = 1,
  maxLabelLength: number = 2
): number {
  const cleanAns = answerText.trim();
  const charCount = cleanAns.length;

  if (charCount > 0) {
    // 1文字あたり約14pxを加算（全角・半角混在に対応）
    const calculated = 56 + charCount * 14;
    return Math.max(80, Math.min(260, calculated));
  }

  // 解答が空（生徒用問題用紙）時のフォールバック
  if (totalCount <= 2) {
    return maxLabelLength > 4 ? 120 : 140; // 約120〜140px
  } else if (totalCount <= 4) {
    return maxLabelLength > 4 ? 100 : 115; // 約100〜115px
  } else {
    return maxLabelLength > 4 ? 80 : 95;   // 約80〜95px（旧56pxから大幅底上げ）
  }
}

/**
 * 単一問題（小問なし）の解答下線幅を解答文字数に応じて動的に計算
 */
export function calculateSingleAnswerLineWidth(answerText: string = ""): number {
  const cleanAns = answerText.trim();
  const charCount = cleanAns.length;
  if (charCount > 0) {
    return Math.max(140, Math.min(320, 80 + charCount * 13));
  }
  return 140; // 旧112px（w-28）から140pxへ拡大
}

/**
 * 互換用: 小問数およびラベルの文字数に応じた解答下線の幅クラス
 */
export function getSubQuestionLineWidthClass(totalCount: number, maxLabelLength: number = 2): string {
  if (maxLabelLength > 4) {
    return totalCount <= 2 ? "w-24" : "w-20";
  }

  if (totalCount <= 2) {
    return "w-28";
  } else if (totalCount <= 4) {
    return "w-22";
  } else {
    return "w-18";
  }
}

/**
 * 日本語（全角）と英数字（半角）を考慮した視覚的な文字幅長さを計算
 */
export function calculateVisualTextLength(text: string): number {
  if (!text) return 0;
  // LaTeX の記号などを簡易除去して視覚的長さを推定
  const clean = text.replace(/\\\(|\\\)/g, "").replace(/\$+/g, "").trim();
  let length = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // 半角英数・半角カナ・一般的なASCII記号・半角スペース
    if ((code >= 0 && code <= 128) || (code >= 0xff61 && code <= 0xff9f)) {
      length += 0.55;
    } else {
      length += 1.0;
    }
  }
  return length;
}

/**
 * 問題文の横幅（文字数）や設問特性、用紙カラム設定に応じて
 * 解答欄を問題文と同じ行（同一行: same-line）に配置できるかを判定
 */
export function isSameLineEligible(params: {
  questionText: string;
  answer?: string;
  subLabels?: string[];
  is2Col?: boolean;
  hasMedia?: boolean; // figureSvg, imageUrl, audioUrl があるか
  configuredLayout?: "auto" | "inline" | "stacked" | "same-line";
}): boolean {
  const {
    questionText,
    subLabels = [],
    is2Col = false,
    hasMedia = false,
    configuredLayout = "auto",
  } = params;

  // 1. 強制設定の確認
  if (configuredLayout === "stacked" || configuredLayout === "inline") {
    // 意図的に従来の stacked または inline が選ばれている場合は同一行にしない
    return false;
  }
  if (configuredLayout === "same-line") {
    // 強制的に same-line が指定されている場合、メディアがなければ同一行
    return !hasMedia;
  }

  // 2. 図形・画像・音声があれば同一行にしない
  if (hasMedia) return false;

  // 3. 問題文に改行が含まれる場合は複数行になるため同一行にしない
  if (questionText.includes("\n")) return false;

  // 4. 小問が2つ以上ある場合は同一行には収まらないため下部配置
  if (subLabels.length > 1) return false;

  // 5. 問題文の視覚的横幅（全角半角換算）を判定
  const visualLen = calculateVisualTextLength(questionText);

  // 2列グリッドの場合: 1列の幅が狭いため、視覚的長さ 20文字（半角英字なら約36文字）以内
  // 例: "apple" (2.75文字), "library" (3.85文字), "beautiful (美しい)" (9.6文字) 等は余裕で同一行
  if (is2Col) {
    return visualLen <= 20;
  }

  // 1列配置の場合: 視覚的長さ 30文字（半角英字なら約55文字）以内
  return visualLen <= 30;
}

/**
 * 同一行（same-line）配置時の解答下線幅を最適計算
 * - 2列グリッド時は 90px〜150px（コンパクトかつ筆記可能な幅）
 * - 1列グリッド時は 130px〜240px
 */
export function calculateSameLineAnswerWidth(answerText: string = "", is2Col: boolean = false): number {
  const cleanAns = answerText.trim();
  const charCount = cleanAns.length;
  if (is2Col) {
    if (charCount > 0) {
      return Math.max(90, Math.min(150, 60 + charCount * 9));
    }
    return 110;
  } else {
    if (charCount > 0) {
      return Math.max(130, Math.min(240, 80 + charCount * 11));
    }
    return 150;
  }
}

/**
 * 模範解答や問題文の性質から、解答欄のレイアウトを自動判定
 *  - inline: 短答・記号・短い計算（右下に横並びコンパクト配置）
 *  - stacked: 英文・並べ替え・記述文（小問ごとに1行ずつのフル幅下線）
 */
export function detectAnswerLayout(
  questionText: string = "",
  answer: string = "",
  subLabels: string[] = []
): "inline" | "stacked" {
  // 小問がない場合は基本的に inline
  if (subLabels.length <= 1) {
    return "inline";
  }

  const normA = answer.trim();
  const normQ = questionText.trim();

  // 1. 並べ替えや英作文のキーワード検知
  const isCompositionOrRearrange = /並べかえ|英文にしなさい|和文英訳|英語に直しなさい|英訳/.test(normQ);

  // 2. 模範解答に英文（スペース区切りで3単語以上の文）が含まれるか
  const hasLongEnglishSentence = /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(normA);

  // 3. 模範解答の小問1問あたりの平均文字数
  const totalLength = normA.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳\(\)\d]/g, "").trim().length;
  const avgLength = totalLength / subLabels.length;

  // 英文1文、並べ替え、または1小問あたり平均12文字以上の記述は stacked (各問1行形式)
  if (isCompositionOrRearrange || hasLongEnglishSentence || avgLength >= 12) {
    return "stacked";
  }

  return "inline";
}

/**
 * 設定された layout ("auto" | "inline" | "stacked" | "same-line") と自動判定結果から最終的なレイアウトを決定
 */
export function resolveAnswerLayout(
  configuredLayout?: "auto" | "inline" | "stacked" | "same-line",
  questionText: string = "",
  answer: string = "",
  subLabels: string[] = []
): "inline" | "stacked" | "same-line" {
  if (configuredLayout === "same-line") return "same-line";
  if (configuredLayout === "inline") return "inline";
  if (configuredLayout === "stacked") return "stacked";
  return detectAnswerLayout(questionText, answer, subLabels);
}
