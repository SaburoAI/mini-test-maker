"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Save,
  FolderOpen,
  FileText,
  Layers,
  Trash2,
  Download,
  Plus,
  RefreshCw,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  Sparkles,
  ArrowRight,
  Database
} from "lucide-react";
import { QuizTest, Question } from "@/types/quiz";

interface TestMeta {
  id: string;
  filename: string;
  title: string;
  subject: string;
  grade: string;
  timeLimitMinutes: number;
  totalPoints: number;
  sectionCount: number;
  questionCount: number;
  updatedAt: string;
  createdAt: string;
}

interface PoolMeta {
  id: string;
  filename: string;
  name: string;
  description?: string;
  questionCount: number;
  genres: string[];
  grades: string[];
  updatedAt: string;
  createdAt: string;
}

interface StorageManagerModalProps {
  isOpen: boolean;
  currentTest: QuizTest;
  currentPool: Question[];
  onClose: () => void;
  onLoadTest: (test: QuizTest) => void;
  onLoadPool: (questions: Question[], mode: "replace" | "append", bankName?: string) => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  currentTest,
  currentPool,
  onClose,
  onLoadTest,
  onLoadPool
}) => {
  const [activeTab, setActiveTab] = useState<"tests" | "pools">("tests");

  // テスト管理用ステート
  const [testList, setTestList] = useState<TestMeta[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [testSaveTitle, setTestSaveTitle] = useState(currentTest.title || "");
  const [testSearch, setTestSearch] = useState("");
  const [isSavingTest, setIsSavingTest] = useState(false);

  // 問題プール管理用ステート
  const [poolList, setPoolList] = useState<PoolMeta[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [poolSaveName, setPoolSaveName] = useState("");
  const [poolSaveDesc, setPoolSaveDesc] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [isSavingPool, setIsSavingPool] = useState(false);

  // メッセージ・トースト通知
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // テスト一覧取得
  const fetchTests = useCallback(async () => {
    setIsLoadingTests(true);
    try {
      const res = await fetch("/api/storage/tests");
      const data = await res.json();
      if (res.ok && data.tests) {
        setTestList(data.tests);
      } else {
        showToast(data.error || "テスト一覧の取得に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("テスト一覧の通信に失敗しました", "error");
    } finally {
      setIsLoadingTests(false);
    }
  }, []);

  // 問題プール一覧取得
  const fetchPools = useCallback(async () => {
    setIsLoadingPools(true);
    try {
      const res = await fetch("/api/storage/pools");
      const data = await res.json();
      if (res.ok && data.pools) {
        setPoolList(data.pools);
      } else {
        showToast(data.error || "問題バンク一覧の取得に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("問題バンク一覧の通信に失敗しました", "error");
    } finally {
      setIsLoadingPools(false);
    }
  }, []);

  // モーダルオープン時に一覧取得とタイトル初期化
  useEffect(() => {
    if (isOpen) {
      setTestSaveTitle(currentTest.title || "小テスト");
      fetchTests();
      fetchPools();
    }
  }, [isOpen, currentTest.title, fetchTests, fetchPools]);

  if (!isOpen) return null;

  // --- テストの保存 ---
  const handleSaveTest = async () => {
    if (!testSaveTitle.trim()) {
      showToast("テスト名を入力してください", "error");
      return;
    }

    setIsSavingTest(true);
    try {
      const testToSave: QuizTest = {
        ...currentTest,
        title: testSaveTitle.trim()
      };

      const res = await fetch("/api/storage/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: testToSave })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || "テストを保存しました", "success");
        fetchTests();
      } else {
        showToast(data.error || "テストの保存に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("保存リクエストに失敗しました", "error");
    } finally {
      setIsSavingTest(false);
    }
  };

  // --- テストの読み込み（呼び出し） ---
  const handleLoadTest = async (testMeta: TestMeta) => {
    const ok = window.confirm(`テスト「${testMeta.title}」を呼び出しますか？\n（現在編集中の内容は置き換わります）`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/storage/tests?filename=${encodeURIComponent(testMeta.filename)}`);
      const data = await res.json();

      if (res.ok && data.test) {
        onLoadTest(data.test);
        showToast(`テスト「${data.test.title}」を呼び出しました`, "success");
        onClose();
      } else {
        showToast(data.error || "テストの読み込みに失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("テスト読み込みに失敗しました", "error");
    }
  };

  // --- テストの削除 ---
  const handleDeleteTest = async (testMeta: TestMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`保存されたテスト「${testMeta.title}」(${testMeta.filename}) を削除しますか？`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/storage/tests?filename=${encodeURIComponent(testMeta.filename)}`, {
        method: "DELETE"
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`テストを削除しました`, "success");
        fetchTests();
      } else {
        showToast(data.error || "削除に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("削除リクエストに失敗しました", "error");
    }
  };

  // --- テストJSONのダウンロード ---
  const handleDownloadTestJson = async (testMeta: TestMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/storage/tests?filename=${encodeURIComponent(testMeta.filename)}`);
      const data = await res.json();
      if (res.ok && data.test) {
        const blob = new Blob([JSON.stringify(data.test, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = testMeta.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- 問題バンクの保存 ---
  const handleSavePool = async () => {
    if (!poolSaveName.trim()) {
      showToast("問題バンク名を入力してください", "error");
      return;
    }

    if (currentPool.length === 0) {
      showToast("保存する問題がありません", "error");
      return;
    }

    setIsSavingPool(true);
    try {
      const res = await fetch("/api/storage/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: poolSaveName.trim(),
          description: poolSaveDesc.trim(),
          questions: currentPool
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message || "問題バンクを保存しました", "success");
        setPoolSaveName("");
        setPoolSaveDesc("");
        fetchPools();
      } else {
        showToast(data.error || "問題バンクの保存に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("保存リクエストに失敗しました", "error");
    } finally {
      setIsSavingPool(false);
    }
  };

  // --- 問題バンクの読み込み ---
  const handleLoadPool = async (poolMeta: PoolMeta, mode: "replace" | "append") => {
    const modeName = mode === "replace" ? "置き換え（既存の問題をクリア）" : "追加（現在のプールにプラス）";
    const ok = window.confirm(`問題バンク「${poolMeta.name}」(${poolMeta.questionCount}問) を${modeName}で読み込みますか？`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/storage/pools?filename=${encodeURIComponent(poolMeta.filename)}`);
      const data = await res.json();

      if (res.ok && data.bank && data.bank.questions) {
        onLoadPool(data.bank.questions, mode, data.bank.name);
        showToast(`問題バンク「${data.bank.name}」(${data.bank.questions.length}問) を読み込みました`, "success");
        onClose();
      } else {
        showToast(data.error || "問題バンクの読み込みに失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("読み込みリクエストに失敗しました", "error");
    }
  };

  // --- 問題バンクの削除 ---
  const handleDeletePool = async (poolMeta: PoolMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`問題バンク「${poolMeta.name}」(${poolMeta.filename}) を削除しますか？`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/storage/pools?filename=${encodeURIComponent(poolMeta.filename)}`, {
        method: "DELETE"
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("問題バンクを削除しました", "success");
        fetchPools();
      } else {
        showToast(data.error || "削除に失敗しました", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast("削除リクエストに失敗しました", "error");
    }
  };

  // --- 問題バンクJSONのダウンロード ---
  const handleDownloadPoolJson = async (poolMeta: PoolMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/storage/pools?filename=${encodeURIComponent(poolMeta.filename)}`);
      const data = await res.json();
      if (res.ok && data.bank) {
        const blob = new Blob([JSON.stringify(data.bank, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = poolMeta.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // フィルタリング
  const filteredTests = testList.filter(t =>
    t.title.toLowerCase().includes(testSearch.toLowerCase()) ||
    t.subject.toLowerCase().includes(testSearch.toLowerCase()) ||
    t.grade.toLowerCase().includes(testSearch.toLowerCase())
  );

  const filteredPools = poolList.filter(p =>
    p.name.toLowerCase().includes(poolSearch.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(poolSearch.toLowerCase())) ||
    p.genres.some(g => g.toLowerCase().includes(poolSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
              <Database className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2 text-white">
                <span>📁 テスト ＆ 問題バンクのローカル保存・呼出</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  data/ フォルダ直結
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                作成した小テスト一式（大問構成・配点・レイアウト）や自作問題プールをローカルに永続化・再利用します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* トースト通知 */}
        {toastMessage && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between transition-all ${
              toastMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-rose-50 text-rose-800 border-b border-rose-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("tests")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs cursor-pointer transition border-t border-x ${
              activeTab === "tests"
                ? "bg-white text-indigo-700 border-slate-200 border-b-white -mb-px shadow-xs"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/80"
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>📝 テスト管理（完成小テスト）</span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {testList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pools")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs cursor-pointer transition border-t border-x ${
              activeTab === "pools"
                ? "bg-white text-indigo-700 border-slate-200 border-b-white -mb-px shadow-xs"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/80"
            }`}
          >
            <Layers className="w-4 h-4 text-purple-600" />
            <span>📚 問題バンク管理（問題プール）</span>
            <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {poolList.length}
            </span>
          </button>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* =========================================================================
              タブ1: テスト管理
             ========================================================================= */}
          {activeTab === "tests" && (
            <div className="space-y-6">
              {/* 現在のテストを保存するカード */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-sky-50/50 border border-indigo-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                      <Save className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                        <span>現在作成中のテストを保存</span>
                        <span className="text-[10px] font-normal text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                          全 {currentTest.sections.reduce((s, sec) => s + sec.questions.length, 0)}問 / {currentTest.totalTargetPoints}点
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        大問構成・配点・小問選択・用紙レイアウトを含む完全なテストデータをファイル保存します
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="テスト名を入力 (例: 2026年9月 中2数学 1次関数基礎小テスト)..."
                      value={testSaveTitle}
                      onChange={e => setTestSaveTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTest}
                    disabled={isSavingTest}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition shrink-0 disabled:opacity-50"
                  >
                    {isSavingTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>名前を付けて保存</span>
                  </button>
                </div>
              </div>

              {/* 保存済みテスト一覧 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-slate-600" />
                    <h4 className="font-bold text-slate-800 text-xs">
                      保存済みテスト一覧（data/tests/）
                    </h4>
                    <button
                      type="button"
                      onClick={fetchTests}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="一覧を更新"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTests ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="保存テストを検索..."
                      value={testSearch}
                      onChange={e => setTestSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isLoadingTests ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                    <span>テスト一覧を読み込み中...</span>
                  </div>
                ) : filteredTests.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs space-y-1">
                    <FileText className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600">保存されたテストがありません</p>
                    <p className="text-[10px] text-slate-400">
                      上部の入力欄からテスト名を入力して「保存」を実行してください
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTests.map(test => (
                      <div
                        key={test.filename}
                        className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-xl p-3.5 transition flex flex-col justify-between group space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-indigo-600 transition">
                              {test.title}
                            </h5>
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                              {test.totalPoints}点満点
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                              {test.grade}
                            </span>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                              {test.subject}
                            </span>
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <BookOpen className="w-3 h-3 text-slate-400" />
                              大問 {test.sectionCount} / 小問 {test.questionCount}
                            </span>
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {test.timeLimitMinutes}分
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[9.5px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-slate-300" />
                            <span>更新: {new Date(test.updatedAt).toLocaleString("ja-JP")}</span>
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div className="text-[9px] text-slate-400 truncate max-w-[140px]" title={test.filename}>
                            {test.filename}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={e => handleDownloadTestJson(test, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="JSONファイルをダウンロード"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleDeleteTest(test, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="このテストを削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLoadTest(test)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition ml-1"
                            >
                              <span>開く</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              タブ2: 問題バンク管理
             ========================================================================= */}
          {activeTab === "pools" && (
            <div className="space-y-6">
              {/* 現在の問題プールを保存するカード */}
              <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/50 border border-purple-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
                      <Save className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                        <span>現在の問題プール（全 {currentPool.length} 問）を問題バンクとして保存</span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        自作問題やAIで生成した問題群をセットにして保存し、必要な時にプールへ読み込めます
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="問題バンク名 (例: 中2数学_1次関数特訓セット)..."
                    value={poolSaveName}
                    onChange={e => setPoolSaveName(e.target.value)}
                    className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSavePool}
                    disabled={isSavingPool}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition shrink-0 disabled:opacity-50"
                  >
                    {isSavingPool ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>問題バンクを保存</span>
                  </button>
                  <input
                    type="text"
                    placeholder="メモ・説明（任意: 例: 難関校向けハイレベル問題を含む）..."
                    value={poolSaveDesc}
                    onChange={e => setPoolSaveDesc(e.target.value)}
                    className="md:col-span-3 px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-[11px] text-slate-700 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 保存済み問題バンク一覧 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-slate-600" />
                    <h4 className="font-bold text-slate-800 text-xs">
                      保存済み問題バンク一覧（data/pools/）
                    </h4>
                    <button
                      type="button"
                      onClick={fetchPools}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="一覧を更新"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPools ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="問題バンクを検索..."
                      value={poolSearch}
                      onChange={e => setPoolSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {isLoadingPools ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
                    <span>問題バンク一覧を読み込み中...</span>
                  </div>
                ) : filteredPools.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs space-y-1">
                    <Layers className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-semibold text-slate-600">保存された問題バンクがありません</p>
                    <p className="text-[10px] text-slate-400">
                      上部の入力欄からバンク名を入力して「問題バンクを保存」を実行してください
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredPools.map(pool => (
                      <div
                        key={pool.filename}
                        className="bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md rounded-xl p-3.5 transition flex flex-col justify-between group space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-purple-600 transition">
                              {pool.name}
                            </h5>
                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 shrink-0">
                              {pool.questionCount}問
                            </span>
                          </div>

                          {pool.description && (
                            <p className="text-[10.5px] text-slate-600 line-clamp-2">
                              {pool.description}
                            </p>
                          )}

                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                            {pool.genres.map(g => (
                              <span key={g} className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {g}
                              </span>
                            ))}
                            {pool.grades.map(gr => (
                              <span key={gr} className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {gr}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 text-[9.5px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-slate-300" />
                            <span>更新: {new Date(pool.updatedAt).toLocaleString("ja-JP")}</span>
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={e => handleDownloadPoolJson(pool, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="JSONファイルをダウンロード"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleDeletePool(pool, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="この問題バンクを削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadPool(pool, "append")}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                              title="現在のプールを維持したまま、このバンクの問題を追加"
                            >
                              <Plus className="w-3 h-3" />
                              <span>追加読込</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLoadPool(pool, "replace")}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition"
                              title="現在のプールをクリアし、このバンクの問題に置き換え"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>置換読込</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">保存場所:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">
              mini-test-maker/data/
            </code>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
