async function runApiTests() {
  const BASE_URL = "http://localhost:3000";
  console.log("=== [STORAGE API TEST START] ===");

  // 1. テスト一覧取得
  console.log("\n1. Testing GET /api/storage/tests");
  const resTests = await fetch(`${BASE_URL}/api/storage/tests`);
  const dataTests = await resTests.json();
  console.log("Response status:", resTests.status);
  console.log("Tests found:", dataTests.tests?.length);
  if (!resTests.ok || !Array.isArray(dataTests.tests)) {
    throw new Error("Failed to get tests list");
  }

  // 2. 新規テスト保存 (POST)
  console.log("\n2. Testing POST /api/storage/tests");
  const newTestObj = {
    id: `test_automated_${Date.now()}`,
    title: "自動テスト用保存テスト",
    subject: "数学",
    grade: "中2",
    timeLimitMinutes: 15,
    totalTargetPoints: 50,
    sections: [
      {
        id: "sec-1",
        title: "大問1 計算テスト",
        targetPoints: 50,
        questions: [
          {
            id: "q-1",
            genre: "数学",
            topic: "式の計算",
            subTopic: "単項式",
            questionText: "次の計算をしなさい。$2x + 3x$",
            answer: "$5x$",
            difficulty: 1,
            estimatedSeconds: 30,
            defaultPoints: 10,
            tags: ["基礎"]
          }
        ]
      }
    ]
  };

  const resPostTest = await fetch(`${BASE_URL}/api/storage/tests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test: newTestObj })
  });
  const dataPostTest = await resPostTest.json();
  console.log("POST status:", resPostTest.status, dataPostTest);
  if (!resPostTest.ok || !dataPostTest.success) {
    throw new Error("Failed to post test");
  }

  const savedFilename = dataPostTest.filename;

  // 3. 保存したテストを取得 (GET by filename)
  console.log("\n3. Testing GET /api/storage/tests?filename=...");
  const resGetOne = await fetch(`${BASE_URL}/api/storage/tests?filename=${encodeURIComponent(savedFilename)}`);
  const dataGetOne = await resGetOne.json();
  console.log("GET one status:", resGetOne.status, "Title:", dataGetOne.test?.title);
  if (dataGetOne.test?.title !== "自動テスト用保存テスト") {
    throw new Error("Saved test content mismatch");
  }

  // 4. テスト削除 (DELETE)
  console.log("\n4. Testing DELETE /api/storage/tests?filename=...");
  const resDelTest = await fetch(`${BASE_URL}/api/storage/tests?filename=${encodeURIComponent(savedFilename)}`, {
    method: "DELETE"
  });
  const dataDelTest = await resDelTest.json();
  console.log("DELETE status:", resDelTest.status, dataDelTest);
  if (!resDelTest.ok || !dataDelTest.success) {
    throw new Error("Failed to delete test");
  }

  // 5. 問題プール一覧取得 (GET)
  console.log("\n5. Testing GET /api/storage/pools");
  const resPools = await fetch(`${BASE_URL}/api/storage/pools`);
  const dataPools = await resPools.json();
  console.log("Pools found:", dataPools.pools?.length);
  if (!resPools.ok || !Array.isArray(dataPools.pools)) {
    throw new Error("Failed to get pools list");
  }

  // 6. 新規問題バンク保存 (POST)
  console.log("\n6. Testing POST /api/storage/pools");
  const resPostPool = await fetch(`${BASE_URL}/api/storage/pools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "自動テスト用問題バンク",
      description: "APIテスト用データ",
      questions: newTestObj.sections[0].questions
    })
  });
  const dataPostPool = await resPostPool.json();
  console.log("POST pool status:", resPostPool.status, dataPostPool);
  if (!resPostPool.ok || !dataPostPool.success) {
    throw new Error("Failed to post pool");
  }

  const savedPoolFilename = dataPostPool.filename;

  // 7. 保存したバンクの削除 (DELETE)
  console.log("\n7. Testing DELETE /api/storage/pools?filename=...");
  const resDelPool = await fetch(`${BASE_URL}/api/storage/pools?filename=${encodeURIComponent(savedPoolFilename)}`, {
    method: "DELETE"
  });
  const dataDelPool = await resDelPool.json();
  console.log("DELETE pool status:", resDelPool.status, dataDelPool);
  if (!resDelPool.ok || !dataDelPool.success) {
    throw new Error("Failed to delete pool");
  }

  console.log("\n=== ALL STORAGE API TESTS PASSED! ===");
}

runApiTests().catch(err => {
  console.error("API test failed:", err);
  process.exit(1);
});
