"use client";

import React, { useState, useEffect } from "react";
import { AppSettings } from "@/types/quiz";
import { DEFAULT_TAG_MASTER, DEFAULT_APP_SETTINGS } from "@/lib/storage";
import { TagInput } from "./TagInput";
import { X, Settings, Tag, BookOpen, GraduationCap, Save, RotateCcw, Check, Sparkles } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  poolTags?: string[];
  onClose: () => void;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  poolTags = [],
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      setIsSavedNotice(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // 全タグ候補（既存タグマスター + プール内のタグ）
  const allAvailableTags = Array.from(new Set([...DEFAULT_TAG_MASTER, ...poolTags]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      onClose();
    }, 600);
  };

  // プリセットタグを一括追加
  const handleAddPresets = () => {
    const combined = Array.from(new Set([...formData.tagMaster, ...DEFAULT_TAG_MASTER]));
    setFormData(prev => ({ ...prev, tagMaster: combined }));
  };

  // 初期値にリセット
  const handleReset = () => {
    if (confirm("設定を初期値に戻しますか？")) {
      setFormData({ ...DEFAULT_APP_SETTINGS });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-indigo-600/60 text-white">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">システム設定 ＆ タグマスター管理</h3>
              <p className="text-[10px] text-slate-400">タグの追加・教科書名や学年のデフォルト設定</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* フォームエリア */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* セクション1: 基本情報の規定値設定 */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 border-b border-slate-200 pb-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>基本情報（既定値）</span>
            </div>
            <p className="text-[11px] text-slate-500">
              新規問題作成やインポート時、未設定の場合に自動補完される初期値です。
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                  <span>標準学年</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 中2, 中1, 高1"
                  value={formData.defaultGrade || ""}
                  onChange={e => setFormData({ ...formData, defaultGrade: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>標準教科書名 / 教材名</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 東京書籍 新しい数学, 啓林館"
                  value={formData.defaultTextbook || ""}
                  onChange={e => setFormData({ ...formData, defaultTextbook: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* セクション2: タグマスター管理 */}
          <div className="space-y-3 bg-indigo-50/50 p-3.5 rounded-lg border border-indigo-100">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                <Tag className="w-4 h-4 text-indigo-600" />
                <span>登録タグマスター管理 ({formData.tagMaster.length}個)</span>
              </div>
              <button
                type="button"
                onClick={handleAddPresets}
                className="text-[10px] font-bold text-indigo-600 bg-white hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition"
                title="教育用標準プリセットタグ（頻出、基礎、計算力など）を一括追加"
              >
                <Sparkles className="w-3 h-3 text-indigo-500" />
                標準タグを一括追加
              </button>
            </div>

            <p className="text-[11px] text-slate-600">
              ここで登録したタグは、問題編集・新規作成・インポート画面で類似タグとして自動リコメンドされます。タグを入力して <kbd className="bg-white border border-slate-300 px-1 rounded font-mono text-[10px]">Enter</kbd> で追加できます。
            </p>

            {/* リコメンド付きタグ入力 */}
            <div className="pt-1">
              <TagInput
                tags={formData.tagMaster}
                onChange={newTags => setFormData({ ...formData, tagMaster: newTags })}
                availableTags={allAvailableTags}
                placeholder="新しいタグ名を入力してEnterでマスターに追加..."
              />
            </div>
          </div>
        </form>

        {/* モーダルフッター */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center gap-1 hover:bg-slate-200 rounded transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            初期値に戻す
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold transition"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              {isSavedNotice ? <Check className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5" />}
              {isSavedNotice ? "保存完了！" : "設定を保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
