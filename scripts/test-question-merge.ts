import { mergeQuestions, unmergeQuestion } from "../lib/questionMergeUtils";
import { Question } from "../types/quiz";

const q1: Question = {
  id: "q1",
  genre: "英語",
  topic: "単語",
  subTopic: "新出単語",
  tags: ["英単語"],
  difficulty: 1,
  estimatedSeconds: 30,
  questionText: "・店、商店：( ① )",
  answer: "① store",
  defaultPoints: 5,
  explanation: "p.45参照"
};

const q2: Question = {
  id: "q2",
  genre: "英語",
  topic: "単語",
  subTopic: "新出単語",
  tags: ["英単語"],
  difficulty: 1,
  estimatedSeconds: 30,
  questionText: "・billion：( ① )",
  answer: "① 10億",
  defaultPoints: 5,
  explanation: "p.46参照"
};

console.log("=== Testing mergeQuestions ===");
const merged = mergeQuestions([q1, q2]);
console.log("Merged questionText:\n" + merged.questionText);
console.log("Merged answer: " + merged.answer);
console.log("Merged answerLabels: " + JSON.stringify(merged.answerLabels));
console.log("Merged points: " + merged.defaultPoints);

console.log("=== Testing unmergeQuestion ===");
const unmerged = unmergeQuestion(merged);
console.log("Unmerged count: " + unmerged.length);
console.log("Unmerged q1 text: " + unmerged[0].questionText);
console.log("Unmerged q2 text: " + unmerged[1].questionText);

console.log("\n=== Testing paren digits merge ===");
const p1: Question = {
  ...q1,
  questionText: "(1) store / shop",
  answer: "(1) 店"
};
const p2: Question = {
  ...q2,
  questionText: "(1) billion",
  answer: "(1) 10億"
};
const pMerged = mergeQuestions([p1, p2]);
console.log("Paren Merged questionText:\n" + pMerged.questionText);
console.log("Paren Merged answer: " + pMerged.answer);

console.log("\n=== Testing cut (hidden) sub-items merge ===");
const qWithCut: Question = {
  id: "q_cut",
  genre: "英語",
  topic: "文法",
  subTopic: "関係代名詞",
  tags: ["関係代名詞"],
  difficulty: 2,
  estimatedSeconds: 60,
  // 枝問編集で (2) がカットされ、(1) のみが出題されている状態
  questionText: "次の各問いに答えよ。\n(1) This is the book which I bought yesterday.",
  answer: "(1) これは私が昨日買った本です。",
  originalQuestionText: "次の各問いに答えよ。\n(1) This is the book which I bought yesterday.\n(2) The boy who is playing soccer is Ken.",
  originalAnswer: "(1) これは私が昨日買った本です。 (2) サッカーをしている少年はケンです。",
  selectedSubItemIndices: [0], // 0 のみ選択、1 は非表示（カット）
  defaultPoints: 5,
  explanation: "関係代名詞"
};

const qNormal: Question = {
  id: "q_norm",
  genre: "英語",
  topic: "文法",
  subTopic: "受動態",
  tags: ["受動態"],
  difficulty: 2,
  estimatedSeconds: 30,
  questionText: "(1) This room is cleaned every day.",
  answer: "(1) この部屋は毎日掃除されます。",
  defaultPoints: 5,
  explanation: "受動態"
};

const cutMerged = mergeQuestions([qWithCut, qNormal]);
console.log("Cut Merged questionText (出題用・選択小問のみ):\n" + cutMerged.questionText);
console.log("Cut Merged originalQuestionText (完全版・非表示小問含む):\n" + cutMerged.originalQuestionText);
console.log("Cut Merged answer: " + cutMerged.answer);
console.log("Cut Merged originalAnswer: " + cutMerged.originalAnswer);
console.log("Cut Merged selectedSubItemIndices: " + JSON.stringify(cutMerged.selectedSubItemIndices));

