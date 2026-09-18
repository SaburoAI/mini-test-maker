"use client";

import React, { useState, useMemo } from "react";
import { Question } from "@/types/quiz";
import { buildSimilarQuestionPrompt, SimilarVariationType } from "@/lib/similarPromptUtils";
import { MathText } from "./MathText";
import { Sparkles, Copy, Check, X, BookOpen, Layers, Sliders, Code2 } from "lucide-react";

interface GenerateSimilarPromptModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onCopied?: () => void;
}

export const GenerateSimilarPromptModal: React.FC<GenerateSimilarPromptModalProps> = ({
  isOpen,
  question,
  onClose,
  onCopied
}) => {
  const [count, setCount] = useState<number>(3);
  const [variationType, setVariationType] = useState<SimilarVariationType>("number_change");
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // プロンプトのリアルタイム自動生成
  const promptText = useMemo(() => {
    if (!question) return "";
    return buildSimilarQuestionPrompt(question, { count, variationType });
  }, [question, count, variationType]);

  if (!isOpen || !question) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setIsCopied(true);
    if (onCopied) {
      onCopied();
    }
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-purple-500/30 rounded-lg border border-purple-400/40">
              <Sparkles className="w-4 h-4 text-purple-200" />
            </span>
            <div>
              <h3 className="font-bold text-sm">類題作成プロンプトの生成</h3>
              <p className="text-[10px] text-purple-200">
                この問題のメタデータを継承した高精度な外部AI向けプロンプトをワンクリック生成
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* モーダル本体 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 元問題のサマリー */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>元問題の確認</span>
              </span>
              <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                {question.grade || "学年未設定"} / {question.genre} / {question.topic}
              </span>
            </div>
            <div className="p-2 bg-white rounded border border-slate-200 font-serif text-slate-900 line-clamp-3">
              <MathText text={question.questionText} />
            </div>
          </div>

          {/* 条件選択エリア */}
          <div className="grid grid-cols-2 gap-3">
            {/* 作成問数 */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>{variationType === "step_up" ? "作成するステップ数" : "作成する類題の数"}</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "1問", value: 1 },
                  { label: "3問 (推奨)", value: 3 },
                  { label: "5問", value: 5 }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCount(opt.value)}
                    className={`py-1.5 rounded border text-xs font-semibold transition cursor-pointer ${
                      count === opt.value
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 類題の方向性 */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Sliders className="w-3 h-3 text-indigo-600" />
                <span>類題のバリエーション</span>
              </label>
              <div className="space-y-1">
                {[
                  { id: "number_change", title: "🔄 数値・単語替え (完全同等)" },
                  { id: "same_level", title: "🎯 同レベルの別パターン" },
                  { id: "slightly_harder", title: "⚡ 少し応用・ひねり" },
                  { id: "step_up", title: "🪜 理解のためのステップアップ問題セット" }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVariationType(item.id as SimilarVariationType)}
                    className={`w-full text-left px-2 py-1 rounded border text-[11px] font-medium transition cursor-pointer flex items-center justify-between ${
                      variationType === item.id
                        ? "bg-purple-50 text-purple-900 border-purple-400 font-bold"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span>{item.title}</span>
                    {variationType === item.id && <Check className="w-3 h-3 text-purple-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 生成プロンプトプレビュー */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">生成されたAI用プロンプト</label>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                出力は```json コードスニペットを指定済み・ChatGPT / Claude / Gemini にそのまま貼り付け可能
              </span>
            </div>
            <textarea
              readOnly
              rows={8}
              value={promptText}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed focus:outline-none select-all"
            />
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            コピー後、AIが出力したJSONを画面上の「取込 / インポート」に貼り付けてください。
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white text-xs font-semibold cursor-pointer transition"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition ${
                isCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-purple-700 hover:bg-purple-800 text-white"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>コピー完了！</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>プロンプトをコピー</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
