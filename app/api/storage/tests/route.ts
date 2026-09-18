import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { QuizTest } from "@/types/quiz";

const TESTS_DIR = path.join(process.cwd(), "data", "tests");

// ディレクトリが存在することを保証
async function ensureDir() {
  try {
    await fs.mkdir(TESTS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create tests directory:", err);
  }
}

// ファイル名サニタイズ
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

/**
 * GET: 保存済みテスト一覧の取得、または特定テストの取得
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const filename = searchParams.get("filename");

    // 特定テストの完全データ取得
    if (id || filename) {
      const files = await fs.readdir(TESTS_DIR);
      let targetFile: string | null = null;

      if (filename && files.includes(filename)) {
        targetFile = filename;
      } else if (id) {
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const raw = await fs.readFile(path.join(TESTS_DIR, file), "utf-8");
            const data: QuizTest = JSON.parse(raw);
            if (data.id === id) {
              targetFile = file;
              break;
            }
          } catch {
            // パース失敗したファイルはスキップ
          }
        }
      }

      if (!targetFile) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      const content = await fs.readFile(path.join(TESTS_DIR, targetFile), "utf-8");
      const test: QuizTest = JSON.parse(content);
      return NextResponse.json({ test, filename: targetFile });
    }

    // 一覧のメタデータ取得
    const files = await fs.readdir(TESTS_DIR);
    const list = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = path.join(TESTS_DIR, file);
        const stats = await fs.stat(filePath);
        const raw = await fs.readFile(filePath, "utf-8");
        const data: QuizTest = JSON.parse(raw);

        const questionCount = (data.sections || []).reduce(
          (sum, sec) => sum + (sec.questions || []).length,
          0
        );

        const totalPoints =
          data.totalTargetPoints ||
          (data.sections || []).reduce(
            (secSum, sec) =>
              secSum + (sec.questions || []).reduce((qSum, q) => qSum + (q.defaultPoints || 10), 0),
            0
          ) || 100;

        // 問題から学年を推定またはフォールバック
        const sampleGrade = (data.sections || [])[0]?.questions[0]?.grade || "中2";

        list.push({
          id: data.id || file.replace(".json", ""),
          filename: file,
          title: data.title || "無題のテスト",
          subject: data.subject || "数学",
          grade: data.grade || sampleGrade,
          timeLimitMinutes: data.timeLimitMinutes || 20,
          totalPoints,
          sectionCount: (data.sections || []).length,
          questionCount,
          updatedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString()
        });
      } catch (err) {
        console.error(`Failed to read test file ${file}:`, err);
      }
    }

    // 更新日時の降順（最新順）にソート
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ tests: list });
  } catch (err: any) {
    console.error("GET /api/storage/tests error:", err);
    return NextResponse.json({ error: err.message || "Failed to load tests" }, { status: 500 });
  }
}

/**
 * POST: テストの新規保存・上書き保存
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();
    const test: QuizTest = body.test;
    const requestedFilename = body.filename;

    if (!test) {
      return NextResponse.json({ error: "Missing test data" }, { status: 400 });
    }

    // IDがない場合は付与
    if (!test.id) {
      test.id = `test_${Date.now()}`;
    }

    let targetFilename = requestedFilename;

    if (!targetFilename) {
      // 既存のファイルで同じ ID を持つものがあるか検索（上書き用）
      const files = await fs.readdir(TESTS_DIR);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(TESTS_DIR, file), "utf-8");
          const existing: QuizTest = JSON.parse(raw);
          if (existing.id === test.id) {
            targetFilename = file;
            break;
          }
        } catch {
          // ignore
        }
      }
    }

    // 新規ファイル名生成
    if (!targetFilename) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
      const titleClean = sanitizeFilename(test.title || "テスト");
      targetFilename = `${dateStr}_${timeStr}_${titleClean}.json`;
    }

    const filePath = path.join(TESTS_DIR, targetFilename);
    await fs.writeFile(filePath, JSON.stringify(test, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      filename: targetFilename,
      id: test.id,
      message: `テスト「${test.title}」を保存しました`
    });
  } catch (err: any) {
    console.error("POST /api/storage/tests error:", err);
    return NextResponse.json({ error: err.message || "Failed to save test" }, { status: 500 });
  }
}

/**
 * DELETE: テストの削除
 */
export async function DELETE(req: NextRequest) {
  try {
    await ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const filename = searchParams.get("filename");

    if (!id && !filename) {
      return NextResponse.json({ error: "Missing id or filename" }, { status: 400 });
    }

    const files = await fs.readdir(TESTS_DIR);
    let targetFile: string | null = null;

    if (filename && files.includes(filename)) {
      targetFile = filename;
    } else if (id) {
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(TESTS_DIR, file), "utf-8");
          const data: QuizTest = JSON.parse(raw);
          if (data.id === id) {
            targetFile = file;
            break;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!targetFile) {
      return NextResponse.json({ error: "Target file not found" }, { status: 404 });
    }

    await fs.unlink(path.join(TESTS_DIR, targetFile));
    return NextResponse.json({ success: true, message: `削除しました: ${targetFile}` });
  } catch (err: any) {
    console.error("DELETE /api/storage/tests error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete test" }, { status: 500 });
  }
}
