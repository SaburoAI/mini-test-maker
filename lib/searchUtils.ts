/**
 * 日本語検索・キーワード照合のための正規化ユーティリティ
 * - 漢数字と算用数字の相互変換（一 ↔ 1, 二 ↔ 2 など）
 * - 全角・半角英数の正規化（NFKC: １次関数 → 1次関数, Ａ → A）
 * - カタカナ ⇄ ひらがな正規化
 * - 小文字化
 */

// カタカナをひらがなに変換
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, match => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

// 漢数字を算用数字に正規化（例: 一次関数 → 1次関数, 中二 → 中2, 三角形 → 3角形）
function kanjiNumbersToDigits(str: string): string {
  const kanjiMap: Record<string, string> = {
    '〇': '0', '零': '0',
    '一': '1', '壱': '1',
    '二': '2', '弐': '2',
    '三': '3', '参': '3',
    '四': '4',
    '五': '5',
    '六': '6',
    '七': '7',
    '八': '8',
    '九': '9',
    '十': '10',
  };

  // 十の複合（十一→11, 二十→20 等）の簡易正規化
  let res = str;
  // 頻出複合パターンの置換
  res = res.replace(/二\s*十/g, '20')
           .replace(/三\s*十/g, '30')
           .replace(/四\s*十/g, '40')
           .replace(/五\s*十/g, '50')
           .replace(/十([一二三四五六七八九])/g, (_, p1) => '1' + (kanjiMap[p1] || '0'));

  // 単独の漢数字の置換
  return res.replace(/[〇零一壱二弐三参四五六七八九十]/g, match => kanjiMap[match] || match);
}

// 算用数字を漢数字に変換するバージョンも作成（逆方向の照合用）
function digitsToKanjiNumbers(str: string): string {
  const digitMap: Record<string, string> = {
    '0': '〇',
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
  };
  return str.replace(/[0-9]/g, match => digitMap[match] || match);
}

/**
 * 検索照合用に文字列を強力に正規化
 * 1. NFKC（全角英数記号 → 半角）
 * 2. 小文字化
 * 3. 漢数字 → 算用数字
 * 4. カタカナ → ひらがな
 * 5. 空白・ハイフン等のノイズ除去
 */
export function normalizeSearchString(text: string): string {
  if (!text) return "";
  let s = text.normalize("NFKC").toLowerCase();
  s = katakanaToHiragana(s);
  s = kanjiNumbersToDigits(s);
  // 不要な連続空白を除去
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * 表記ゆれを吸収するマッチ判定
 * ターゲット（問題文やタグ）の中にクエリが含まれているかを判定
 * 例:
 *  target="1次関数の意味", query="一次関数" => true
 *  target="一次関数", query="1次関数" => true
 *  target="中2数学", query="中二" => true
 */
export function fuzzySearchMatch(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normTarget = normalizeSearchString(target);
  const normQuery = normalizeSearchString(query);

  // 1. 正規化同士での包含判定（一次関数 → 1次関数 でマッチ）
  if (normTarget.includes(normQuery)) return true;

  // 2. 逆変換（算用数字 → 漢数字）でも包含判定
  const kanjiQuery = digitsToKanjiNumbers(normQuery);
  const kanjiTarget = digitsToKanjiNumbers(normTarget);
  if (kanjiTarget.includes(kanjiQuery)) return true;

  // 3. 複数単語（スペース区切り）のAND検索
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    return queryTokens.every(token => normTarget.includes(token));
  }

  return false;
}
