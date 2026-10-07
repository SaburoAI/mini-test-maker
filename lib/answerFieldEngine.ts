import { Question } from "@/types/quiz";
import { parseSubItems, ParsedSubItem } from "./subItemUtils";
import {
  extractSubQuestionLabels,
  extractSubQuestionAnswerMap,
  isSymbolLabel
} from "./answerUtils";

export type AnswerStructureType =
  | "block-blanks"    // 親小問 (1), (2)... の中に子空所 ①, ②... が存在する階層型
  | "item-inline"     // 箇条書き単語や短い小問の右側に1対1で解答欄を配置する型
  | "multi-part"      // 1つの問題文に複数の解答要素（傾き・切片など）がある型
  | "cloze-passage"   // 会話文・長文の中に空所が散在し、本文直下に集約配置する型
  | "standard";       // 通常の単一問題または標準小問

/**
 * 親小問・子空所ブロック型における1小問ブロックの情報
 */
export interface ParentBlockItem {
  index: number;
  originalLabel: string;        // "(1)", "（１）", "1." 等
  rawText: string;              // ブロック全体のテキスト
  promptText: string;           // 問題内容
  blankLabels: string[];        // この親小問に属する空所ラベル（例: ["①", "②", "③"]）
  blankAnswerMap: Map<string, string>; // 空所ラベルごとの正解（例: "①" => "There"）
  hasBlanks: boolean;           // 空所記号を含んでいるか
}

/**
 * 汎用解答欄解析エンジンの解析結果
 */
export interface AnswerFieldStructure {
  type: AnswerStructureType;
  // block-blanks 型の場合のブロックリスト
  blockItems?: ParentBlockItem[];
  // cloze-passage や multi-part や standard 型の場合のグローバルラベル
  globalLabels: string[];
  globalAnswerMap: Map<string, string>;
  // 全体空所数
  totalBlankCount: number;
}

/**
 * 文字列から空所記号（丸数字 ①〜⑳、または角括弧 [ ① ]、(ア)〜(オ) など）を抽出
 */
export function extractBlankSymbolsFromText(text: string): string[] {
  if (!text) return [];

  // 1. 丸数字 ①〜⑳ の抽出（文中の ( ① ) や [ ① ] や 生の ① など）
  const circledMatches = text.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g);
  if (circledMatches && circledMatches.length > 0) {
    // 重複を除去し出現順を維持
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of circledMatches) {
      if (!seen.has(m)) {
        seen.add(m);
        result.push(m);
      }
    }
    return result;
  }

  // 2. カッコカナ (ア), (イ)... または （ア）, （イ）...
  const kanaMatches = text.match(/(?:\(|\（)([アイウエオカキクケコサシスセソ])(?:\)|\）)/g);
  if (kanaMatches && kanaMatches.length > 0) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of kanaMatches) {
      const clean = m.replace(/[（\(\)）]/g, "");
      const formatted = `(${clean})`;
      if (!seen.has(formatted)) {
        seen.add(formatted);
        result.push(formatted);
      }
    }
    return result;
  }

  return [];
}

/**
 * 問題文と解答から、最適な解答欄構造を包括的に解析する
 */
export function analyzeAnswerFieldStructure(
  questionText: string,
  answerText: string = "",
  explanationText: string = "",
  customLabels?: string[],
  answerLayout?: string
): AnswerFieldStructure {
  const normQ = (questionText || "").trim();
  const normA = (answerText || "").trim();

  // 1. 小問（(1), (2)... や箇条書き）の解析
  const parsedSub = parseSubItems(normQ, normA, explanationText);

  // 全体解答マップ（解答文字列から全ラベルの解答を抽出）
  const allCircledInAns = normA.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g) || [];
  const uniqueCircledInAns = Array.from(new Set(allCircledInAns));

  // 2. 【パターンA】親小問・子空所ブロック型 (block-blanks) の判定
  // 親小問が複数あり、かつ各小問の中に丸数字などの空所記号が含まれている場合
  if (parsedSub.hasSubItems && parsedSub.items.length >= 2 && answerLayout !== "stacked") {
    // 各アイテム内に空所記号が含まれているかチェック
    let blockWithBlanksCount = 0;
    const blockItems: ParentBlockItem[] = [];

    // まず解答全体の丸数字マップを作成
    const fullAnsMap = extractSubQuestionAnswerMap(normA, uniqueCircledInAns.length > 0 ? uniqueCircledInAns : [
      "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩",
      "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"
    ]);

    for (let i = 0; i < parsedSub.items.length; i++) {
      const item = parsedSub.items[i];
      const itemText = item.promptText || item.rawLine;
      const blanksInBlock = extractBlankSymbolsFromText(itemText);

      if (blanksInBlock.length > 0) {
        blockWithBlanksCount++;
      }

      const itemAnsMap = new Map<string, string>();
      blanksInBlock.forEach(bLbl => {
        const foundAns = fullAnsMap.get(bLbl);
        if (foundAns) {
          itemAnsMap.set(bLbl, foundAns);
        } else if (item.answerText) {
          // 個別アイテムの解答テキストからのフォールバック
          itemAnsMap.set(bLbl, item.answerText);
        }
      });

      blockItems.push({
        index: i,
        originalLabel: item.originalLabel,
        rawText: item.rawLine,
        promptText: item.promptText,
        blankLabels: blanksInBlock,
        blankAnswerMap: itemAnsMap,
        hasBlanks: blanksInBlock.length > 0
      });
    }

    // 少なくとも1ブロックが複数空所を持つ場合のみ block-blanks（階層型）と判定する。
    // 全ブロックが空所1個ずつの場合は、単語リストなど実質フラットなリストのため item-inline（2列可）に委ねる。
    const hasMultiBlankBlock = blockItems.some(b => b.blankLabels.length >= 2);
    if (hasMultiBlankBlock && (blockWithBlanksCount >= 2 || (blockWithBlanksCount >= 1 && blockWithBlanksCount === parsedSub.items.length))) {
      const allLabels = blockItems.flatMap(b => b.blankLabels);
      return {
        type: "block-blanks",
        blockItems,
        globalLabels: allLabels,
        globalAnswerMap: fullAnsMap,
        totalBlankCount: allLabels.length
      };
    }
  }

  // 3. 【パターンB】会話文・長文空所補充型 (cloze-passage)
  // 小問 (1), (2) はないが、問題文中に複数の空所記号（①〜⑳）が存在する場合
  const blanksInWholeQ = extractBlankSymbolsFromText(normQ);
  if (!parsedSub.hasSubItems && blanksInWholeQ.length >= 2) {
    const fullAnsMap = extractSubQuestionAnswerMap(normA, blanksInWholeQ);
    return {
      type: "cloze-passage",
      globalLabels: blanksInWholeQ,
      globalAnswerMap: fullAnsMap,
      totalBlankCount: blanksInWholeQ.length
    };
  }

  // 4. 【パターンC】標準の小問または単一問題
  const subLabels = extractSubQuestionLabels(normQ, normA, customLabels);
  const ansMap = extractSubQuestionAnswerMap(normA, subLabels);

  // 複数要素解答型（傾き・切片など）
  const isMultiPart = !parsedSub.hasSubItems && subLabels.length >= 2 && !subLabels.some(l => isSymbolLabel(l));
  if (isMultiPart) {
    return {
      type: "multi-part",
      globalLabels: subLabels,
      globalAnswerMap: ansMap,
      totalBlankCount: subLabels.length
    };
  }

  return {
    type: "standard",
    globalLabels: subLabels,
    globalAnswerMap: ansMap,
    totalBlankCount: subLabels.length
  };
}
