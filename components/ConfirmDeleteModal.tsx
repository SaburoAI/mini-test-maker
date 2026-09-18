"use client";

import React from "react";
import { Question } from "@/types/quiz";
import { MathText } from "./MathText";
import { AlertTriangle, X, Trash2 } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  question,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
            <h3 className="font-bold text-sm">問題プールから削除の確認</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 space-y-3.5 text-xs text-slate-700">
          <p className="font-bold text-slate-900 leading-relaxed">
            以下の問題を問題プールから完全に削除しますか？
          </p>

          {/* 削除対象問題のプレビューカード */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-serif text-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-sans font-semibold text-slate-500">
              {question.grade && (
                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  {question.grade}
                </span>
              )}
              <span>{question.topic}</span>
              {question.subTopic && <span>/ {question.subTopic}</span>}
            </div>
            <div className="text-xs line-clamp-3 leading-relaxed">
              <MathText text={question.questionText} />
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded p-2.5 text-[11px] text-rose-800 flex items-start gap-1.5 leading-normal">
            <span className="font-bold shrink-0">⚠️ 注意:</span>
            <span>
              プールから削除するとストック一覧から除外されます（現在テスト用紙に配置されている場合は用紙側には残ります）。
            </span>
          </div>
        </div>

        {/* フッターアクション */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-md text-xs transition"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            削除を実行する
          </button>
        </div>
      </div>
    </div>
  );
};
