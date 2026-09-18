"use client";

import React, { useState, useEffect } from "react";
import { Question } from "@/types/quiz";
import { importQuestionsFromTsv, importQuestionsFromMiniJson } from "@/lib/storage";
import { TagInput } from "./TagInput";
import { X, Table, FileJson, Copy, Check, ArrowDownToLine, BookOpen, GraduationCap, Tag as TagIcon, Sparkles } from "lucide-react";

interface ImportExportModalProps {
  isOpen: boolean;
  defaultGrade?: string;
  defaultTextbook?: string;
  availableTags?: string[];
  onClose: () => void;
  onImportSuccess: (imported: Question[], skipDuplicates: boolean) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  defaultGrade = "中2",
  defaultTextbook = "",
  availableTags = [],
  onClose,
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<"tsv" | "json">("json");
  const [inputText, setInputText] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [fallbackGrade, setFallbackGrade] = useState(defaultGrade);
  const [fallbackTextbook, setFallbackTextbook] = useState(defaultTextbook);
  const [fallbackTags, setFallbackTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFallbackGrade(defaultGrade);
      setFallbackTextbook(defaultTextbook);
      setFallbackTags([]);
      setErrorMsg("");
    }
  }, [isOpen, defaultGrade, defaultTextbook]);

  if (!isOpen) return null;

  const sampleAiPrompt = `以下の教材内容から問題を抽出し、以下の短縮JSON形式で出力してください（マークダウンや挨拶不要）。
{"meta":{"tb":"教科書名(例:東書 新しい数学2)","gr":"学年(例:中2)","tags":["タグ1","タグ2"]},"questions":[{"tb":"教科書名","gr":"学年","g":"ジャンル","t":"メイン単元","st":"サブ論点","tg":["タグ1","タグ2"],"d":難易度1~3,"s":秒数,"q":"問題文(TeX対応)","a":"解答","al":["解答欄1","解答欄2(複数解答時のみ・省略可)"],"ly":"stacked(1行記述時)またはsame-line(単語等で問題と同一横並び)","e":"解説","svg":"図形SVG(任意)","as":"放送台本・原稿(リスニング時・教師用紙に印字)"}]}`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(sampleAiPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleExecuteImport = () => {
    setErrorMsg("");
    const text = inputText.trim();
    if (!text) {
      setErrorMsg("テキストを入力してください。");
      return;
    }

    try {
      let imported: Question[] = [];
      const fallback = {
        grade: fallbackGrade.trim() || undefined,
        textbook: fallbackTextbook.trim() || undefined,
        tags: fallbackTags.length > 0 ? fallbackTags : undefined
      };

      if (activeTab === "tsv") {
        imported = importQuestionsFromTsv(text, fallback);
      } else {
        imported = importQuestionsFromMiniJson(text, fallback);
      }

      if (imported.length === 0) {
        setErrorMsg("有効な問題を検出できませんでした。フォーマットをご確認ください。");
        return;
      }

      onImportSuccess(imported, skipDuplicates);
      setInputText("");
      onClose();
    } catch (err: any) {
      setErrorMsg("解析に失敗しました: " + (err?.message || "形式不正"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">問題の一括取込（Mini-JSON / スプレッドシート）</h3>
              <p className="text-[10px] text-slate-400">外部AI出力のJSONまたはTSVから問題を一括登録</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* タブナビ */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 text-xs">
          <button
            onClick={() => {
              setActiveTab("json");
              setErrorMsg("");
            }}
            className={`px-4 py-2 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "json"
                ? "border-indigo-600 text-indigo-800 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-600" />
            Mini-JSON（外部AIコピペ用・推奨）
          </button>
          <button
            onClick={() => {
              setActiveTab("tsv");
              setErrorMsg("");
            }}
            className={`px-4 py-2 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "tsv"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5 text-emerald-600" />
            Googleスプレッドシート（TSV貼り付け）
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
          {/* 取込時の基本情報（任意補完）欄 */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                取込時の基本情報（任意補完・一括付与）
              </span>
              <span className="text-[10px] text-slate-400">未設定の問題に自動適用されます</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-amber-600" />
                  学年 (gr)
                </label>
                <input
                  type="text"
                  placeholder="例: 中2, 中1, 高1"
                  value={fallbackGrade}
                  onChange={e => setFallbackGrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-600" />
                  教科書名 / 教材名 (tb)
                </label>
                <input
                  type="text"
                  placeholder="例: 東京書籍 新しい数学2"
                  value={fallbackTextbook}
                  onChange={e => setFallbackTextbook(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <TagIcon className="w-3 h-3 text-indigo-600" />
                一括付与タグ (tg) — 類似候補リコメンド ＆ Enterキーで追加
              </label>
              <TagInput
                tags={fallbackTags}
                onChange={setFallbackTags}
                availableTags={availableTags}
                placeholder="インポート問題に一括付与するタグを入力してEnter (例: 2学期期末)..."
              />
            </div>
          </div>

          {activeTab === "json" ? (
            <div className="space-y-2">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-[11px] text-indigo-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    💡 外部AI（ChatGPT / Claude / Gemini）用プロンプト
                  </span>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="px-2 py-0.5 bg-white border border-indigo-300 hover:bg-indigo-100 rounded text-[10px] font-bold text-indigo-700 flex items-center gap-1 shadow-2xs transition"
                  >
                    {copiedPrompt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedPrompt ? "コピー完了！" : "プロンプトをコピー"}
                  </button>
                </div>
                <p className="text-indigo-800 text-[10px] font-mono leading-relaxed bg-white/70 p-1.5 rounded border border-indigo-100 max-h-20 overflow-y-auto">
                  {sampleAiPrompt}
                </p>
              </div>

              <textarea
                rows={7}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder='{"meta":{"tb":"東書 数学2","gr":"中2"},"questions":[{"tb":"新しい数学2","gr":"中2","g":"図形","t":"円周角の定理","st":"基本","tg":["頻出"],"d":2,"s":60,"q":"...","a":"..."}]}'
                className="w-full p-2.5 border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[11px] text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  💡 Googleスプレッドシートの行をそのままコピー＆ペースト
                </div>
                <p className="text-emerald-800">
                  ヘッダー列：
                  <code className="bg-white/80 px-1 py-0.5 rounded text-emerald-950 font-mono text-[10px]">
                    学年 / 教科書 / ジャンル / メイン単元 / サブ論点 / タグ / 難易度 / 想定秒数 / 問題文 / 解答 / 解説 / SVG
                  </code>
                </p>
              </div>

              <textarea
                rows={8}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="スプレッドシートからコピーしたTSV行をここに貼り付けてください..."
                className="w-full p-2.5 border border-slate-300 rounded-md font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-slate-50"
              />
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={e => setSkipDuplicates(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-medium text-[11px]">
              既存の同一問題を重複追加しない（タグ等をマージ補完）
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-md transition text-xs"
            >
              キャンセル
            </button>
            <button
              onClick={handleExecuteImport}
              className={`px-5 py-1.5 text-white font-bold rounded-md shadow-xs transition text-xs flex items-center gap-1.5 ${
                activeTab === "tsv"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              問題を一括取込
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
