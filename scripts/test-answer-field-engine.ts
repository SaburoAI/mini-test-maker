import { analyzeAnswerFieldStructure } from "../lib/answerFieldEngine";

import { parseSubItems } from "../lib/subItemUtils";

console.log("=== 1. Testing There is/are (block-blanks) ===");
const q1 = {
  q: "次の日本文の意味を表すように、空所に適する語を書きなさい。\n(1) テーブルの上に1本の鉛筆があります。\n( ① ) ( ② ) a pencil ( ③ ) the table.\n(2) この町にはいくつかのカフェがあります。\n( ④ ) ( ⑤ ) some cafes ( ⑥ ) this town.\n(3) いすの上にネコが2匹いますか。――はい、います。\n( ⑦ ) ( ⑧ ) two cats on the chair? ―― Yes, ( ⑨ ) ( ⑩ ).\n(4) その市には動物園がありますか。――いいえ、ありません。\n( ⑪ ) ( ⑫ ) a zoo in the city? ―― No, ( ⑬ ) ( ⑭ ).",
  a: "① There ② is ③ on ④ There ⑤ are ⑥ in ⑦ Are ⑧ there ⑨ there ⑩ are ⑪ Is ⑫ there ⑬ there ⑭ isn't [is not]"
};

const parsed1 = parseSubItems(q1.q, q1.a);
console.log("parsed1 hasSubItems:", parsed1.hasSubItems, "items length:", parsed1.items.length);
parsed1.items.forEach((it, i) => {
  console.log(`ParsedItem[${i}]: label=${it.originalLabel}, raw=${JSON.stringify(it.rawLine)}`);
});

const res1 = analyzeAnswerFieldStructure(q1.q, q1.a);
console.log("Type:", res1.type);
console.log("Total blanks:", res1.totalBlankCount);
if (res1.blockItems) {
  res1.blockItems.forEach(b => {
    console.log(`Block ${b.originalLabel}:`);
    console.log(`  Blanks:`, b.blankLabels);
    console.log(`  Answers:`, Array.from(b.blankAnswerMap.entries()));
  });
}

console.log("\n=== 2. Testing Math multi-part ===");
const q2 = {
  q: "次の1次関数のグラフの傾きと切片をいいなさい。\n$y=-6x+5$",
  a: "傾き: $-6$, 切片: $5$"
};
const res2 = analyzeAnswerFieldStructure(q2.q, q2.a);
console.log("Type:", res2.type);
console.log("Labels:", res2.globalLabels);
console.log("Answers:", Array.from(res2.globalAnswerMap.entries()));

console.log("\n=== 3. Testing Single passage cloze ===");
const q3 = {
  q: "次の文の空所に適する語を書きなさい。\nI want to take a beautiful picture ( ① ) ( ② ).",
  a: "① like ② this"
};
const res3 = analyzeAnswerFieldStructure(q3.q, q3.a);
console.log("Type:", res3.type);
console.log("Labels:", res3.globalLabels);
console.log("Answers:", Array.from(res3.globalAnswerMap.entries()));
