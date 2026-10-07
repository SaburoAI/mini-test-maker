import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { QuizTest } from "@/types/quiz";

const TESTS_DIR = path.join(process.cwd(), "data", "tests");
const BACKUPS_DIR = path.join(TESTS_DIR, "backups");

// ディレクトリが存在することを保証
async function ensureDir() {
  try {
    await fs.mkdir(TESTS_DIR, { recursive: true });
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create tests/backups directory:", err);
  }
}

// ファイル名サニタイズ
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

/**
 * 既存ファイルをバックアップディレクトリに自動退避
 */
async function backupFile(filename: string) {
  try {
    await ensureDir();
    const srcPath = path.join(TESTS_DIR, filename);
    const exists = await fs.stat(srcPath).then(() => true).catch(() => false);
    if (!exists) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const backupName = `${dateStr}_${timeStr}_backup_${filename}`;
    const destPath = path.join(BACKUPS_DIR, backupName);

    await fs.copyFile(srcPath, destPath);
    console.log(`[Backup] Created backup: ${backupName} for ${filename}`);
  } catch (err) {
    console.error(`Failed to backup ${filename}:`, err);
  }
}

/**
 * GET: 保存済みテスト一覧の取得、特定テストの取得、またはバックアップ一覧の取得
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const filename = searchParams.get("filename");
    const isBackups = searchParams.get("backups") === "true";
    const backupFilename = searchParams.get("backupFilename");

    // バックアップ個別取得
    if (backupFilename) {
      const backupPath = path.join(BACKUPS_DIR, backupFilename);
      const exists = await fs.stat(backupPath).then(() => true).catch(() => false);
      if (!exists) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      }
      const raw = await fs.readFile(backupPath, "utf-8");
      const test: QuizTest = JSON.parse(raw);
      return NextResponse.json({ test, backupFilename });
    }

    // バックアップ一覧取得
    if (isBackups) {
      const files = await fs.readdir(BACKUPS_DIR);
      const list = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const filePath = path.join(BACKUPS_DIR, file);
          const stats = await fs.stat(filePath);
          const raw = await fs.readFile(filePath, "utf-8");
          const data: QuizTest = JSON.parse(raw);

          list.push({
            id: data.id || file,
            filename: file,
            title: data.title || "無題のテスト",
            updatedAt: stats.mtime.toISOString(),
            createdAt: stats.birthtime.toISOString(),
            questionCount: (data.sections || []).reduce(
              (sum, sec) => sum + (sec.questions || []).length,
              0
            )
          });
        } catch {
          // ignore
        }
      }
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return NextResponse.json({ backups: list });
    }

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
 * POST: テストの新規保存・上書き保存、またはバックアップからの復元
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();

    // バックアップからの復元アクション
    if (body.action === "restore") {
      const backupFilename = body.backupFilename;
      if (!backupFilename) {
        return NextResponse.json({ error: "Missing backupFilename" }, { status: 400 });
      }
      const backupPath = path.join(BACKUPS_DIR, backupFilename);
      const raw = await fs.readFile(backupPath, "utf-8");
      const restoredTest: QuizTest = JSON.parse(raw);

      // 復元テスト用に新しいIDとファイル名を生成して保存
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
      restoredTest.id = `test_${Date.now()}`;
      const titleClean = sanitizeFilename(restoredTest.title || "復元テスト");
      const restoredFilename = `${dateStr}_${timeStr}_復元_${titleClean}.json`;

      await fs.writeFile(
        path.join(TESTS_DIR, restoredFilename),
        JSON.stringify(restoredTest, null, 2),
        "utf-8"
      );

      return NextResponse.json({
        success: true,
        test: restoredTest,
        filename: restoredFilename,
        message: `バックアップから復元しました: ${restoredTest.title}`
      });
    }

    const test: QuizTest = body.test;
    const requestedFilename = body.filename;
    // 保存モード: "new" (新規保存・別名保存) または "overwrite" (上書き保存)
    const saveMode: "new" | "overwrite" = body.saveMode || (requestedFilename ? "overwrite" : "new");

    if (!test) {
      return NextResponse.json({ error: "Missing test data" }, { status: 400 });
    }

    let targetFilename: string | null = null;

    if (saveMode === "new") {
      // 新規保存（別名保存）: 必ず新しい一意な ID を発行し、新規ファイルを作成
      test.id = `test_${Date.now()}`;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
      const titleClean = sanitizeFilename(test.title || "テスト");
      targetFilename = `${dateStr}_${timeStr}_${titleClean}.json`;
    } else {
      // 上書き保存 (overwrite)
      if (requestedFilename) {
        targetFilename = requestedFilename;
      } else if (test.id) {
        // 既存のファイルで同じ ID を持つものを検索
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

      // 上書き対象が見つからなければ、新規保存として扱う
      if (!targetFilename) {
        test.id = test.id || `test_${Date.now()}`;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
        const titleClean = sanitizeFilename(test.title || "テスト");
        targetFilename = `${dateStr}_${timeStr}_${titleClean}.json`;
      } else {
        // 上書きする直前に、元の既存ファイルを自動バックアップ！
        await backupFile(targetFilename);
      }
    }

    const filePath = path.join(TESTS_DIR, targetFilename);
    await fs.writeFile(filePath, JSON.stringify(test, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      filename: targetFilename,
      id: test.id,
      message: `テスト「${test.title}」を${saveMode === "new" ? "新規保存" : "上書き保存"}しました`
    });
  } catch (err: any) {
    console.error("POST /api/storage/tests error:", err);
    return NextResponse.json({ error: err.message || "Failed to save test" }, { status: 500 });
  }
}

/**
 * DELETE: テストの削除（削除直前にバックアップ退避）
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

    // 削除直前にバックアップに退避（誤削除時の復活を可能にする）
    await backupFile(targetFile);

    await fs.unlink(path.join(TESTS_DIR, targetFile));
    return NextResponse.json({
      success: true,
      message: `削除しました（バックアップに退避済み）: ${targetFile}`
    });
  } catch (err: any) {
    console.error("DELETE /api/storage/tests error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete test" }, { status: 500 });
  }
}
