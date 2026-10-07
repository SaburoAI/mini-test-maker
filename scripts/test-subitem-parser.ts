import {
  parseSubItems,
  reconstructQuestionWithSelectedSubItems,
  formatSubLabel,
  ParsedSubItem,
  SubItemLabelType
} from "../lib/subItemUtils";

interface TestCase {
  name: string;
  questionText: string;
  answerText: string;
  expectedItemCount: number;
  expectedHasSubItems: boolean;
  expectedLabelType?: SubItemLabelType;
  testReconstruction?: boolean;
}

const testCases: TestCase[] = [
  {
    name: "Case 1: 英語の空所補充問題 (1)-(14) 行頭(1)＋末尾:( 1 )",
    questionText: `Fill in the blanks (1)-(14) with suitable English or Japanese.
(1) store / shop: ( 1 )
(2) mail / post: ( 2 )
(3) chart: ( 3 )
(4) pie chart: ( 4 )
(5) billion: ( 5 )
(6) drinking water: ( 6 )
(7) pond: ( 7 )
(8) presentation: ( 8 )
(9) should: ( 9 )
(10) dirty: ( 10 )
(11) directly: ( 11 )
(12) than: ( 12 )
(13) office: ( 13 )
(14) more than: ( 14 )`,
    answerText: `(1) 店 (2) 郵便 (3) 図表 (4) 円グラフ (5) 10億 (6) 飲料水 (7) 池 (8) 発表 (9) 〜すべき (10) 汚い (11) 直接 (12) より (13) 事務所 (14) 以上`,
    expectedItemCount: 14,
    expectedHasSubItems: true,
    expectedLabelType: "paren",
    testReconstruction: true
  },
  {
    name: "Case 2: 丸数字の小問 ①〜③",
    questionText: `次の各問いに答えよ。
① 2x + 3 = 7
② 5x - 4 = 11
③ 3x + 2 = 14`,
    answerText: `① 2 ② 3 ③ 4`,
    expectedItemCount: 3,
    expectedHasSubItems: true,
    expectedLabelType: "circled",
    testReconstruction: true
  },
  {
    name: "Case 3: 全角括弧数字 （１）〜（３）",
    questionText: `次の計算をしなさい。（１）〜（３）
（１） 12 + 34
（２） 56 - 23
（３） 7 × 8`,
    answerText: `（１） 46 （２） 33 （３） 56`,
    expectedItemCount: 3,
    expectedHasSubItems: true,
    expectedLabelType: "fullParen",
    testReconstruction: true
  },
  {
    name: "Case 4: 箇条書き空所補充 ( ① )",
    questionText: `次の空欄を埋めよ。
・富士山の標高：( ① )m
・琵琶湖の面積：( ② )km2
・信濃川の長さ：( ③ )km`,
    answerText: `① 3776 ② 670 ③ 367`,
    expectedItemCount: 3,
    expectedHasSubItems: true,
    expectedLabelType: "circled",
    testReconstruction: true
  },
  {
    name: "Case 5: 枝問のない単一問題（1問完結）",
    questionText: `二次方程式 x^2 - 5x + 6 = 0 を解きなさい。`,
    answerText: `x = 2, 3`,
    expectedItemCount: 0,
    expectedHasSubItems: false,
    testReconstruction: false
  }
];

function runTests() {
  console.log("=== [PARSER TEST SUITE START] ===");
  let passedCount = 0;
  let failedCount = 0;

  for (const tc of testCases) {
    console.log(`\n--- Testing: ${tc.name} ---`);
    const parsed = parseSubItems(tc.questionText, tc.answerText);

    let caseFailed = false;

    if (parsed.hasSubItems !== tc.expectedHasSubItems) {
      console.error(`  FAIL: hasSubItems expected ${tc.expectedHasSubItems}, got ${parsed.hasSubItems}`);
      caseFailed = true;
    }

    if (parsed.items.length !== tc.expectedItemCount) {
      console.error(`  FAIL: items.length expected ${tc.expectedItemCount}, got ${parsed.items.length}`);
      caseFailed = true;
    }

    if (tc.expectedLabelType && parsed.labelType !== tc.expectedLabelType) {
      console.error(`  FAIL: labelType expected ${tc.expectedLabelType}, got ${parsed.labelType}`);
      caseFailed = true;
    }

    if (!caseFailed) {
      console.log(`  PASS: Parsed ${parsed.items.length} items correctly, labelType: ${parsed.labelType}`);
    }

    // 再構成テスト（間引き・リナンバリング）
    if (tc.testReconstruction && parsed.items.length >= 3) {
      console.log(`  Testing reconstruction (Select items 0 and 2, dropping item 1)...`);
      const recon = reconstructQuestionWithSelectedSubItems(
        parsed.leadInText,
        parsed.items,
        [0, 2], // 1問目と3問目を選択
        parsed.labelType
      );

      console.log(`  Reconstructed Lines:`);
      recon.newQuestionText.split("\n").forEach((line, i) => {
        console.log(`    [${i}] ${line}`);
      });
      console.log(`  Reconstructed Answer: ${recon.newAnswer}`);
      console.log(`  Reconstructed Answer Labels: ${JSON.stringify(recon.newAnswerLabels)}`);

      // 検証: 新番号が (1) と (2) になっているか
      const expectedLabel1 = formatSubLabel(1, parsed.labelType);
      const expectedLabel2 = formatSubLabel(2, parsed.labelType);

      if (recon.newAnswerLabels.length !== 2 || recon.newAnswerLabels[0] !== expectedLabel1 || recon.newAnswerLabels[1] !== expectedLabel2) {
        console.error(`  FAIL: newAnswerLabels incorrect! Expected [${expectedLabel1}, ${expectedLabel2}], got ${JSON.stringify(recon.newAnswerLabels)}`);
        caseFailed = true;
      }

      // Case 1 の場合: (3) chart: ( 3 ) だったものが (2) chart: ( 2 ) に更新されているか
      if (tc.name.includes("Case 1")) {
        const line2 = recon.newQuestionText.split("\n")[2]; // 0: leadIn, 1: item1, 2: item2
        console.log(`  Checking Case 1 second item line: "${line2}"`);
        if (!line2 || !line2.includes("(2) chart: ( 2 )")) {
          console.error(`  FAIL: Case 1 second item line should be "(2) chart: ( 2 )", but got: "${line2}"`);
          caseFailed = true;
        }
      }
    }

    if (caseFailed) {
      failedCount++;
    } else {
      passedCount++;
    }
  }

  // 編集テスト（枝問編集モーダルでの編集シミュレーション）
  console.log(`\n--- Testing: SubItem Editing & Modification ---`);
  {
    const initialText = `次の問いに答えよ。
(1) リンゴは英語で何ですか。
(2) ミカンは英語で何ですか。
(3) バナナは英語で何ですか。`;
    const initialAns = `(1) apple (2) orange (3) banana`;

    const parsed = parseSubItems(initialText, initialAns);
    // ユーザーが小問(1)のプロンプトを「ブドウは英語で何ですか。」に編集したとする
    const modifiedItems: ParsedSubItem[] = [...parsed.items];
    modifiedItems[0] = {
      ...modifiedItems[0],
      promptText: "ブドウは英語で何ですか。",
      answerText: "grape"
    };

    // 再構成
    const recon = reconstructQuestionWithSelectedSubItems(
      parsed.leadInText,
      modifiedItems,
      [0, 1, 2],
      parsed.labelType
    );

    console.log(`  Edited prompt test result:`);
    recon.newQuestionText.split("\n").forEach(l => console.log(`    ${l}`));
    console.log(`  Edited answer result: ${recon.newAnswer}`);

    if (!recon.newQuestionText.includes("ブドウは英語で何ですか。")) {
      console.error(`  FAIL: Modified prompt not reflected in reconstructed question!`);
      failedCount++;
    } else if (!recon.newAnswer.includes("grape")) {
      console.error(`  FAIL: Modified answer not reflected in reconstructed answer!`);
      failedCount++;
    } else {
      console.log(`  PASS: SubItem editing successfully reflected in reconstruction!`);
      passedCount++;
    }
  }

  // テスト: 枝問なし単一問題から枝問を手動追加・分割するケース
  console.log(`\n--- Testing: Manual SubItem Addition to Single Item ---`);
  {
    const singleQText = "二次方程式 x^2 - 5x + 6 = 0 を解きなさい。";
    const singleAns = "x = 2, 3";
    const parsed = parseSubItems(singleQText, singleAns);

    // モーダルが開いたとき、初期アイテムとして1問目が作成される
    const items: ParsedSubItem[] = [
      {
        index: 0,
        rawLine: singleQText,
        originalNumber: 1,
        originalLabel: "(1)",
        labelType: "paren",
        promptText: singleQText,
        answerText: singleAns
      },
      // ユーザーが「枝問を追加」ボタンで2問目を追加
      {
        index: 1,
        rawLine: "(2) x^2 - 7x + 12 = 0 を解きなさい。",
        originalNumber: 2,
        originalLabel: "(2)",
        labelType: "paren",
        promptText: "x^2 - 7x + 12 = 0 を解きなさい。",
        answerText: "x = 3, 4"
      }
    ];

    const recon = reconstructQuestionWithSelectedSubItems(
      "次の二次方程式を解きなさい。",
      items,
      [0, 1],
      "paren"
    );

    console.log(`  Manual addition reconstructed:`);
    recon.newQuestionText.split("\n").forEach(l => console.log(`    ${l}`));
    console.log(`  Answer: ${recon.newAnswer}`);

    if (
      recon.newQuestionText.includes("(1) 二次方程式 x^2 - 5x + 6 = 0 を解きなさい。") &&
      recon.newQuestionText.includes("(2) x^2 - 7x + 12 = 0 を解きなさい。") &&
      recon.newAnswer === "(1) x = 2, 3 (2) x = 3, 4"
    ) {
      console.log(`  PASS: Manual addition to single item succeeded!`);
      passedCount++;
    } else {
      console.error(`  FAIL: Manual addition output mismatch!`);
      failedCount++;
    }
  }

  // テスト: 箇条書き空所問題の編集
  console.log(`\n--- Testing: Bullet Blank Editing & Reordering ---`);
  {
    const text = `次の空欄を埋めよ。
・富士山の標高：( ① )m
・琵琶湖の面積：( ② )km2`;
    const parsed = parseSubItems(text, "① 3776 ② 670");
    // ユーザーが1問目のテキストを編集（空所記号を維持したまま文字を修正）
    const items = [...parsed.items];
    items[0] = {
      ...items[0],
      promptText: "・日本一高い富士山の標高：( ① )m",
      answerText: "3776"
    };

    const recon = reconstructQuestionWithSelectedSubItems(
      parsed.leadInText,
      items,
      [0, 1],
      parsed.labelType
    );

    console.log(`  Bullet blank edit result:`);
    recon.newQuestionText.split("\n").forEach(l => console.log(`    ${l}`));

    if (recon.newQuestionText.includes("・日本一高い富士山の標高：( ① )m") && !recon.newQuestionText.includes("(1) ・")) {
      console.log(`  PASS: Bullet blank edit preserved format without erroneous prefix!`);
      passedCount++;
    } else {
      console.error(`  FAIL: Bullet blank edit resulted in unwanted prefix or missing content!`);
      failedCount++;
    }
  }

  // テスト: エスケープ機能のテスト（"" や 「」 で囲まれた (1) や （１） が分割されないこと）
  console.log(`\n--- Testing: Escaped SubItem Labels ("(1)", "（１）", 「(1)」) ---`);
  {
    const escapedSingleQ = `問題文の中に引用 "(1)" や "（１）"、および「(2)」が含まれていますが、これは枝問ではありません。`;
    const parsedSingle = parseSubItems(escapedSingleQ, "解答");
    if (!parsedSingle.hasSubItems && parsedSingle.items.length === 0) {
      console.log(`  PASS: Escaped "(1)" inside single question is NOT parsed as subitems!`);
      passedCount++;
    } else {
      console.error(`  FAIL: Escaped "(1)" was erroneously parsed as subitems! count: ${parsedSingle.items.length}`);
      failedCount++;
    }

    // 枝問プロンプト内にエスケープされた "(1)" がある場合
    const escapedSubItemText = `次の問いに答えよ。
(1) x の値を求めよ。
(2) "(1)" の結果を用いて y の値を求めよ。`;
    const parsedSub = parseSubItems(escapedSubItemText, "(1) 5 (2) 10");
    if (parsedSub.hasSubItems && parsedSub.items.length === 2 && parsedSub.items[1].promptText.includes('"(1)"')) {
      console.log(`  PASS: Escaped "(1)" in subitem prompt is preserved: "${parsedSub.items[1].promptText}"`);
      passedCount++;
    } else {
      console.error(`  FAIL: Escaped "(1)" was not preserved properly!`, parsedSub.items);
      failedCount++;
    }

    // disabled フラグのテスト
    const disabledText = `次の問いに答えよ。
(1) 最初の問題
(2) 次の問題`;
    const parsedDisabled = parseSubItems(disabledText, "(1) A (2) B", "", true);
    if (!parsedDisabled.hasSubItems && parsedDisabled.items.length === 0) {
      console.log(`  PASS: disabled = true correctly bypassed subitem parsing!`);
      passedCount++;
    } else {
      console.error(`  FAIL: disabled = true did not bypass subitem parsing!`);
      failedCount++;
    }
  }

  console.log(`\n=== [TEST SUMMARY] ===`);
  console.log(`Passed: ${passedCount}, Failed: ${failedCount}`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
