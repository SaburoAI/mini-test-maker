import { INITIAL_TEST, INITIAL_QUESTION_POOL } from "../lib/seedData";
import fs from "fs";
import path from "path";

const testsDir = path.join(process.cwd(), "data", "tests");
const poolsDir = path.join(process.cwd(), "data", "pools");

if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });
if (!fs.existsSync(poolsDir)) fs.mkdirSync(poolsDir, { recursive: true });

// サンプルテスト
const sampleTestPath = path.join(testsDir, "sample_1次関数と変化の割合_基礎テスト.json");
fs.writeFileSync(sampleTestPath, JSON.stringify(INITIAL_TEST, null, 2), "utf-8");

// サンプル問題バンク
const sampleBankPath = path.join(poolsDir, "sample_中2数学_標準問題バンク.json");
const bankData = {
  id: "bank_middle2_math_sample",
  name: "中2数学 標準問題バンク（1次関数・連立・図形）",
  description: "東京書籍 新しい数学2 準拠の標準シード問題セット（137問）",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questions: INITIAL_QUESTION_POOL
};
fs.writeFileSync(sampleBankPath, JSON.stringify(bankData, null, 2), "utf-8");

console.log("Seed data files generated successfully!");
