# AI小テストジェネレーター（AI Quiz Maker）初期セットアップ＆開発手順書

本書は、新規プロジェクト `quiz-maker`（または任意のアプリ名）を立ち上げ、最短で動作するプロトタイプから本番品質まで組み上げるための手順書です。

---

## 1. プロジェクトの新規作成（初回のみ）

ターミナル（PowerShell等）を開き、プロダクト用ディレクトリ（例: `c:\Users\bsblm\Documents\00MyProduct\`）で以下を実行します。

### 1.1 Next.js プロジェクトの作成
```bash
npx create-next-app@latest quiz-maker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```
* 対話プロンプトが出た場合の推奨選択:
  * TypeScript: `Yes`
  * ESLint: `Yes`
  * Tailwind CSS: `Yes`
  * `src/` directory: `Yes`
  * App Router: `Yes`
  * Turbopack: 任意（デフォルト推奨）
  * customize import alias: `No` (`@/*` のまま)

### 1.2 必要なライブラリのインストール
作成されたフォルダに移動し、主要ライブラリをインストールします。
```bash
cd quiz-maker
npm install @google/generative-ai lucide-react papaparse clsx tailwind-merge
npm install -D @types/papaparse
```
※ 数式表示（LaTeX）が必要な場合は追加で以下も導入可能:
```bash
npm install katex
npm install -D @types/katex
```

### 1.3 環境変数の設定
プロジェクト直下に `.env.local` を作成し、Gemini APIキーを記述します。
```env
# .env.local
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```
> [!IMPORTANT]
> APIキーを安全に保つため、クライアント側（ブラウザ）から直接呼ぶのではなく、Next.jsのAPI Route（`/api/parse-pdf` 等）を経由して呼び出します。これにより、クライアントバンドルにキーが露出することを完全に防止します。

---

## 2. 推奨ディレクトリ構成

```text
quiz-maker/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── parse-pdf/        # Gemini API を呼び出すサーバーエンドポイント
│   │   │       └── route.ts
│   │   ├── globals.css           # 画面用 + @media print 用CSS
│   │   ├── layout.tsx
│   │   └── page.tsx              # メイン画面（3ペイン構成 or タブ構成）
│   ├── components/
│   │   ├── editor/               # 問題テーブル編集・スプレッドシート風UI
│   │   │   ├── QuizTableEditor.tsx
│   │   │   └── QuestionRow.tsx
│   │   ├── preview/              # 用紙プレビュー＆印刷コンポーネント
│   │   │   ├── PaperSheet.tsx
│   │   │   ├── QuestionBlock.tsx
│   │   │   └── AnswerBlock.tsx
│   │   ├── uploader/             # PDF / CSV / JSON アップローダー
│   │   │   └── FileDropZone.tsx
│   │   └── common/               # ツールバー・ヘッダー
│   │       └── Header.tsx
│   ├── types/
│   │   └── quiz.ts               # QuizItem, QuizSheetSettings 型定義
│   └── utils/
│       ├── csvParser.ts          # Papaparse によるCSV変換ユーティリティ
│       └── printHelper.ts        # 印刷トリガー
├── .env.local
├── package.json
└── tailwind.config.ts
```

---

## 3. 実装ステップ（最速で動かすためのロードマップ）

### ステップ 1: 型定義とCSV/JSONインポート（即座に動作確認）
1. `src/types/quiz.ts` に問題データの型（`QuizItem`）を定義。
2. サンプルのCSVファイル（またはJSON）をドラッグ＆ドロップすると、画面に問題一覧テーブルが表示されるUIを作成。
3. まずはAI抜きで「手持ちのCSVを読み込み、編集できる状態」を確立する。

### ステップ 2: 印刷用プレビュー＆CSS Print（WYSIWYG化）
1. 画面右半分に「A4用紙プレビュー」を配置。
2. テーブルで選択・編集した問題が、A4縦（2段組）のテスト用紙として綺麗にレイアウトされるコンポーネントを作成。
3. `window.print()` で印刷プレビューを開いた際、ツールバー等のUIが消え、用紙部分だけが完璧に印刷されるよう `@media print` スタイルを記述。
4. **「問題用紙」と「解答・解説用紙」の切り替え表示・印刷機能** を実装。

### ステップ 3: Gemini API によるPDF自動解析
1. Next.js API Route `src/app/api/parse-pdf/route.ts` を作成。
2. アップロードされたPDFファイルを `gemini-2.0-flash` に送信。
3. **Structured Outputs (responseSchema)** または JSON モードを指定して、確実に `QuizItem[]` の配列形式で返却させるプロンプトを構築（後述）。
4. フロントエンドのドロップゾーンからPDFを投げると、数秒でテーブルに問題が自動流し込みされるパイプラインを結合。

### ステップ 4: 仕上げと便利機能の追加
* CSV/JSON ダウンロード機能（作成した問題セットの保存）
* 問題のシャッフル機能（出題順をランダム化してA/Bテスト作成）
* 配点合計の自動計算機能（100点満点への自動配分機能）

---

## 4. Gemini API用 構造化プロンプト（API Route 実装例）

```typescript
// src/app/api/parse-pdf/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
以下のPDF文書から小テスト用の問題を抽出し、JSON形式で出力してください。
各問題について以下のプロパティを含めてください:
- id: ランダムな文字列
- questionNumber: 1からの連番
- questionText: 問題文 (数式がある場合は \\( ... \\) のLaTeX記法)
- choices: 選択肢がある場合のみ文字列の配列 (例: ["ア: ...", "イ: ..."])
- answer: 模範解答
- explanation: 簡単な解説 (記載がある場合)
- points: 配点 (明記がなければ5)
- formatType: "short_answer" | "multiple_choice" | "fill_in_the_blank" | "term" のいずれか
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type || "application/pdf",
          data: base64Data,
        },
      },
    ]);

    const jsonText = result.response.text();
    const quizItems = JSON.parse(jsonText);

    return NextResponse.json({ questions: quizItems });
  } catch (error: any) {
    console.error("Parse error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 5. 印刷CSSのベストプラクティス（ズレ・余白の解消）

```css
/* src/app/globals.css */
@media print {
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* 画面操作用UIを非表示 */
  .no-print {
    display: none !important;
  }

  /* 用紙コンテナをA4実寸に固定 */
  .print-page {
    width: 210mm !important;
    min-height: 297mm !important;
    padding: 15mm !important;
    margin: 0 auto !important;
    box-shadow: none !important;
    page-break-after: always;
    break-after: page;
  }
}
```

---

## 6. まとめ

以上の手順に従うことで、**既存の `kakomon-data-base` のコードを一切汚すことなく**、小テスト作成に100%特化した高速かつ高品質なアプリケーションを迅速に立ち上げることができます。
