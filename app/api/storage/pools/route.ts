import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Question } from "@/types/quiz";

const POOLS_DIR = path.join(process.cwd(), "data", "pools");

export interface QuestionBankFile {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

// ディレクトリが存在することを保証
async function ensureDir() {
  try {
    await fs.mkdir(POOLS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create pools directory:", err);
  }
}

// ファイル名サニタイズ
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

/**
 * GET: 保存済み問題バンク一覧の取得、または特定バンクの取得
 */
export async function GET(req: NextRequest) {
  try {
    await ensureDir();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const filename = searchParams.get("filename");

    // 特定バンクの完全データ取得
    if (id || filename) {
      const files = await fs.readdir(POOLS_DIR);
      let targetFile: string | null = null;

      if (filename && files.includes(filename)) {
        targetFile = filename;
      } else if (id) {
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const raw = await fs.readFile(path.join(POOLS_DIR, file), "utf-8");
            const data = JSON.parse(raw);
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
        return NextResponse.json({ error: "Question bank not found" }, { status: 404 });
      }

      const content = await fs.readFile(path.join(POOLS_DIR, targetFile), "utf-8");
      const bankData = JSON.parse(content);
      // 単純な配列（Question[]）で保存されていた場合もケア
      const bank: QuestionBankFile = Array.isArray(bankData)
        ? {
            id: targetFile.replace(".json", ""),
            name: targetFile.replace(".json", ""),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            questions: bankData
          }
        : bankData;

      return NextResponse.json({ bank, filename: targetFile });
    }

    // 一覧のメタデータ取得
    const files = await fs.readdir(POOLS_DIR);
    const list = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const filePath = path.join(POOLS_DIR, file);
        const stats = await fs.stat(filePath);
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);

        const questions: Question[] = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        const name = (!Array.isArray(parsed) && parsed.name) ? parsed.name : file.replace(".json", "");
        const id = (!Array.isArray(parsed) && parsed.id) ? parsed.id : file.replace(".json", "");
        const description = (!Array.isArray(parsed) && parsed.description) ? parsed.description : "";

        // 教科・学年の内訳集計
        const genres = Array.from(new Set(questions.map(q => q.genre).filter(Boolean)));
        const grades = Array.from(new Set(questions.map(q => q.grade).filter(Boolean)));

        list.push({
          id,
          filename: file,
          name,
          description,
          questionCount: questions.length,
          genres,
          grades,
          updatedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString()
        });
      } catch (err) {
        console.error(`Failed to read pool file ${file}:`, err);
      }
    }

    // 更新日時の降順にソート
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ pools: list });
  } catch (err: any) {
    console.error("GET /api/storage/pools error:", err);
    return NextResponse.json({ error: err.message || "Failed to load pools" }, { status: 500 });
  }
}

/**
 * POST: 問題バンクの保存
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const body = await req.json();
    const name: string = body.name || "問題バンク";
    const description: string = body.description || "";
    const questions: Question[] = body.questions || [];
    const requestedFilename: string = body.filename;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Questions list is empty" }, { status: 400 });
    }

    const id = body.id || `bank_${Date.now()}`;
    const now = new Date().toISOString();

    const bankData: QuestionBankFile = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      questions
    };

    let targetFilename = requestedFilename;
    if (!targetFilename) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      targetFilename = `${dateStr}_${sanitizeFilename(name)}.json`;
    }

    const filePath = path.join(POOLS_DIR, targetFilename);
    await fs.writeFile(filePath, JSON.stringify(bankData, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      filename: targetFilename,
      id,
      message: `問題バンク「${name}」(${questions.length}問) を保存しました`
    });
  } catch (err: any) {
    console.error("POST /api/storage/pools error:", err);
    return NextResponse.json({ error: err.message || "Failed to save pool" }, { status: 500 });
  }
}

/**
 * DELETE: 問題バンクの削除
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

    const files = await fs.readdir(POOLS_DIR);
    let targetFile: string | null = null;

    if (filename && files.includes(filename)) {
      targetFile = filename;
    } else if (id) {
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = await fs.readFile(path.join(POOLS_DIR, file), "utf-8");
          const data = JSON.parse(raw);
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

    await fs.unlink(path.join(POOLS_DIR, targetFile));
    return NextResponse.json({ success: true, message: `削除しました: ${targetFile}` });
  } catch (err: any) {
    console.error("DELETE /api/storage/pools error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete pool" }, { status: 500 });
  }
}
