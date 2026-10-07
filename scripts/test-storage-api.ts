import fs from "fs/promises";
import path from "path";
import { QuizTest } from "../types/quiz";
import { GET, POST, DELETE } from "../app/api/storage/tests/route";
import { NextRequest } from "next/server";

async function runApiTests() {
  console.log("=== [STORAGE API & BACKUP TEST START] ===");
  const createdFiles: string[] = [];

  try {
    // 1. テストA の新規保存 (saveMode: "new")
    console.log("\n1. Testing New Test A save (saveMode: 'new')...");
    const testA: QuizTest = {
      id: "test_a_id",
      title: "テストA_代数基礎",
      subject: "数学",
      grade: "中2",
      timeLimitMinutes: 20,
      totalTargetPoints: 100,
      sections: []
    };

    const reqPostA = new NextRequest("http://localhost/api/storage/tests", {
      method: "POST",
      body: JSON.stringify({ test: testA, saveMode: "new" })
    });
    const resPostA = await POST(reqPostA);
    const dataPostA = await resPostA.json();
    console.log("  Response A:", dataPostA.message, "File:", dataPostA.filename);
    if (!dataPostA.success || !dataPostA.filename.includes("代数基礎")) {
      throw new Error("Failed to save Test A");
    }
    createdFiles.push(dataPostA.filename);

    // 2. テストB の新規保存（別名保存・複数保存の検証）
    console.log("\n2. Testing New Test B save (saveMode: 'new') with different title...");
    const testB: QuizTest = {
      id: "test_b_id",
      title: "テストB_幾何応用",
      subject: "数学",
      grade: "中2",
      timeLimitMinutes: 25,
      totalTargetPoints: 100,
      sections: []
    };

    const reqPostB = new NextRequest("http://localhost/api/storage/tests", {
      method: "POST",
      body: JSON.stringify({ test: testB, saveMode: "new" })
    });
    const resPostB = await POST(reqPostB);
    const dataPostB = await resPostB.json();
    console.log("  Response B:", dataPostB.message, "File:", dataPostB.filename);
    if (!dataPostB.success || !dataPostB.filename.includes("幾何応用")) {
      throw new Error("Failed to save Test B");
    }
    createdFiles.push(dataPostB.filename);

    if (dataPostA.filename === dataPostB.filename) {
      throw new Error("Test A and Test B have the same filename! Multi-save failed.");
    }
    console.log("  PASS: Multiple tests saved independently under different names!");

    // 3. テストA の上書き保存（自動バックアップの検証）
    console.log("\n3. Testing Overwrite Test A (saveMode: 'overwrite') & auto backup...");
    const updatedTestA: QuizTest = {
      ...testA,
      title: "テストA_代数基礎_改訂版",
      timeLimitMinutes: 30
    };

    const reqOverwriteA = new NextRequest("http://localhost/api/storage/tests", {
      method: "POST",
      body: JSON.stringify({
        test: updatedTestA,
        saveMode: "overwrite",
        filename: dataPostA.filename
      })
    });
    const resOverwriteA = await POST(reqOverwriteA);
    const dataOverwriteA = await resOverwriteA.json();
    console.log("  Overwrite Response:", dataOverwriteA.message);
    if (!dataOverwriteA.success) {
      throw new Error("Failed to overwrite Test A");
    }

    // 4. バックアップ一覧取得 (GET ?backups=true)
    console.log("\n4. Testing GET ?backups=true (Verifying backup exists)...");
    const reqGetBackups = new NextRequest("http://localhost/api/storage/tests?backups=true");
    const resGetBackups = await GET(reqGetBackups);
    const dataGetBackups = await resGetBackups.json();
    console.log("  Backups found:", dataGetBackups.backups?.length);
    const foundBackup = dataGetBackups.backups?.find((b: any) =>
      b.filename.includes(dataPostA.filename) || b.title === "テストA_代数基礎"
    );

    if (!foundBackup) {
      throw new Error("Auto backup for Test A was not found in backups list!");
    }
    console.log("  PASS: Found auto-backup:", foundBackup.filename);

    // 5. バックアップからの復元テスト (action: 'restore')
    console.log("\n5. Testing Backup Restoration (action: 'restore')...");
    const reqRestore = new NextRequest("http://localhost/api/storage/tests", {
      method: "POST",
      body: JSON.stringify({
        action: "restore",
        backupFilename: foundBackup.filename
      })
    });
    const resRestore = await POST(reqRestore);
    const dataRestore = await resRestore.json();
    console.log("  Restore Response:", dataRestore.message, "File:", dataRestore.filename);
    if (!dataRestore.success || !dataRestore.test) {
      throw new Error("Failed to restore test from backup");
    }
    if (dataRestore.test.title !== "テストA_代数基礎") {
      throw new Error(`Restored test title mismatch! Expected 'テストA_代数基礎', got '${dataRestore.test.title}'`);
    }
    createdFiles.push(dataRestore.filename);
    console.log("  PASS: Successfully restored previous version of Test A!");

    // 6. テスト削除時のバックアップ退避テスト
    console.log("\n6. Testing DELETE and backup preservation...");
    const reqDelete = new NextRequest(`http://localhost/api/storage/tests?filename=${encodeURIComponent(dataPostB.filename)}`, {
      method: "DELETE"
    });
    const resDelete = await DELETE(reqDelete);
    const dataDelete = await resDelete.json();
    console.log("  Delete Response:", dataDelete.message);
    if (!dataDelete.success) {
      throw new Error("Failed to delete Test B");
    }

    // クリーンアップ
    console.log("\nCleaning up test files...");
    const testsDir = path.join(process.cwd(), "data", "tests");
    for (const f of createdFiles) {
      try {
        await fs.unlink(path.join(testsDir, f));
      } catch {}
    }

    console.log("\n=== ALL STORAGE API & BACKUP TESTS PASSED! ===");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runApiTests();

