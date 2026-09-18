import { Question } from "@/types/quiz";

export type SimilarVariationType = "number_change" | "same_level" | "slightly_harder" | "step_up";

export interface SimilarPromptOptions {
  count: number;
  variationType: SimilarVariationType;
}

/**
 * 元問題のメタデータと設定オプションから、外部LLM用の高精度な類題生成プロンプトを生成
 */
export function buildSimilarQuestionPrompt(question: Question, options: SimilarPromptOptions): string {
  const { count, variationType } = options;

  let variationInstruction = "";
  let introLine = "";
  if (variationType === "number_change") {
    variationInstruction = "・【数値・単語の置換（完全同等レベル）】: 解法プロセスや文法ルール・設問構成は完全に維持し、数値・係数・登場人物・名詞などのみを適切に変更した類題を作成してください。";
    introLine = `以下の【元問題】を参考にして、同等の形式・学習目標を持つ【類題】を【${count}問】作成し、指定のJSON形式で出力してください。`;
  } else if (variationType === "same_level") {
    variationInstruction = "・【同難易度の別パターン】: 同じ単元・論点・学習指導要領の範囲内で、問われ方やシチュエーションを少し変えた同レベルの問題を作成してください。";
    introLine = `以下の【元問題】を参考にして、同等の形式・学習目標を持つ【類題】を【${count}問】作成し、指定のJSON形式で出力してください。`;
  } else if (variationType === "slightly_harder") {
    variationInstruction = "・【少し応用・ひねり】: 元問題の知識を前提としつつ、1ステップ思考力が必要な少し応用的な問題を作成してください（極端な難問にはしないでください）。";
    introLine = `以下の【元問題】を参考にして、同等の形式・学習目標を持つ【類題】を【${count}問】作成し、指定のJSON形式で出力してください。`;
  } else {
    variationInstruction = `・【理解のためのステップアップ問題セット】: 元問題をいきなり解けない生徒のために、元問題を解くのに必要な前提知識・部分スキルを分解し、易しい順に積み上げていく問題セットを作成してください。各問題の "st"（サブ論点）には、その問題が鍛える部分スキルを明記してください。難易度（"d"）は1問目を最も易しく（レベル1）し、最終問題が元問題と同程度（レベル${question.difficulty}）になるよう単調に増加させてください。`;
    introLine = `以下の【元問題】を生徒が無理なく理解できるように、必要な前提知識から元問題と同程度の難易度まで段階的に引き上げる【理解のためのステップアップ問題セット】を【${count}問】作成し、指定のJSON形式で出力してください。`;
  }

  const tagList = question.tags && question.tags.length > 0 ? question.tags.join(", ") : "なし";
  const defaultTag = variationType === "step_up" ? "ステップアップ" : "類題";

  return `${introLine}

### 【元問題の情報】
- 教科: ${question.genre || "一般"}
- 学年: ${question.grade || "未設定"}
- 教科書名: ${question.textbook || "未設定"}
- メイン単元: ${question.topic || "単元未設定"}
- サブ論点: ${question.subTopic || "基本"}
- 難易度: レベル${question.difficulty} (1:基礎, 2:標準, 3:発展)
- タグ: ${tagList}
- 問題文:
${question.questionText}
- 解答:
${question.answer}
${question.answerLabels && question.answerLabels.length > 0 ? `- 複数解答欄項目: ${question.answerLabels.join(", ")}` : ""}
${question.answerLayout ? `- 解答欄形式: ${question.answerLayout}` : ""}
${question.imageUrl ? `- 画像URL: ${question.imageUrl}` : ""}
${question.audioUrl ? `- 音声URL: ${question.audioUrl}` : ""}
${question.audioScript ? `- 放送台本（スクリプト）:\n${question.audioScript}` : ""}

### 【作成ルール】
${variationInstruction}
- 数式は必ず TeX 形式（インライン数式は $ ... $、独立した数式は $$ ... $$）で厳密に記述してください。
- 複数の要素を同時に答える問題の場合は、"al": ["項目1", "項目2"] のように解答欄ラベル配列を明示してください。
- 英文記述や並べ替え、記述文など解答が1文以上で長い場合は "ly": "stacked"、英単語テストや短答問題で問題文と解答欄を同一行に並べたい場合は "ly": "same-line" を指定してください。
- 英語リスニング問題等で放送原稿がある場合は、"as": "放送台本・スクリプト原稿" を記述してください（教師用解答プリントに自動印字されます）。※画像や音声のファイルパスはアプリ上で問題ごとに手動設定するため、JSON内への画像・音声パス出力は不要です。
- 各問題の解説（"e"）も簡潔に記述してください。

### 【出力フォーマット】
前置きや挨拶は一切含めず、以下の Mini-JSON 配列形式を \`\`\`json コードブロック（コードスニペット）で囲んだ状態で出力してください。プレーンテキストのみの出力は不可とします。

\`\`\`json
[
  {
    "gr": "${question.grade || '中2'}",
    "tb": "${question.textbook || ''}",
    "g": "${question.genre || '数学'}",
    "t": "${question.topic || '単元名'}",
    "st": "${question.subTopic || '論点名'}",
    "tg": [${question.tags && question.tags.length > 0 ? question.tags.map(t => `"${t}"`).join(", ") : `"${defaultTag}"`}],
    "d": ${question.difficulty},
    "s": ${question.estimatedSeconds || 60},
    "q": "作成した問題文",
    "a": "作成した解答",
    "al": ${question.answerLabels && question.answerLabels.length > 0 ? JSON.stringify(question.answerLabels) : '["解答1", "解答2"] // 複数解答時のみ'},
    "ly": "${question.answerLayout || 'inline'}",
    "e": "作成した解説"${question.audioScript ? `,\n    "as": "作成したリスニング放送台本・スクリプト"` : ""}
  }
]
\`\`\`
`;
}
