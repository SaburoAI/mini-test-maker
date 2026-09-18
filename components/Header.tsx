import React from "react";
import { Layers, Printer, Table, FileJson, GraduationCap, FileCheck, Settings, Undo2, FolderOpen } from "lucide-react";

interface HeaderProps {
  sheetMode: "student" | "teacher";
  setSheetMode: (mode: "student" | "teacher") => void;
  onOpenStorageModal?: () => void;
  onOpenImportModal: () => void;
  onExportTsv: () => void;
  onExportJson: () => void;
  onOpenSettingsModal?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onPrint?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sheetMode,
  setSheetMode,
  onOpenStorageModal,
  onOpenImportModal,
  onExportTsv,
  onExportJson,
  onOpenSettingsModal,
  onUndo,
  canUndo = false,
  onPrint
}) => {
  return (
    <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 px-6 py-2.5 flex items-center justify-between shadow-md">
      {/* ロゴ & タイトル */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base tracking-tight text-white">AI ミニテストメーカー</h1>
            <span className="text-[10px] font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full">
              Next.js 15 Edition
            </span>
          </div>
          <p className="text-xs text-slate-400">20分小テストを最短工数で作成・印刷・スプレッドシート連携</p>
        </div>
      </div>

      {/* アクション群 */}
      <div className="flex items-center gap-3">
        {/* 生徒用 / 解答付きモード切替 */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <button
            onClick={() => setSheetMode("student")}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition ${
              sheetMode === "student"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            生徒用問題
          </button>
          <button
            onClick={() => setSheetMode("teacher")}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition ${
              sheetMode === "teacher"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            模範解答付
          </button>
        </div>

        {/* データ保存・呼出 & スプレッドシート連携ボタン */}
        <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
          {onOpenStorageModal && (
            <button
              type="button"
              onClick={onOpenStorageModal}
              className="px-2.5 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 border border-indigo-400/50 rounded-md text-xs text-white font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="作成したテストや問題バンクをローカル(data/)に保存・呼び出し"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-200" />
              保存・呼出
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-200 font-medium flex items-center gap-1.5 transition shadow-xs"
            title="スプレッドシートまたはMini-JSONから問題を一括取込"
          >
            <Table className="w-3.5 h-3.5 text-emerald-400" />
            取込 / インポート
          </button>

          <button
            onClick={onExportTsv}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-200 font-medium flex items-center gap-1.5 transition shadow-xs"
            title="Googleスプレッドシート貼り付け用TSVをクリップボードにコピー"
          >
            <Table className="w-3.5 h-3.5 text-blue-400" />
            スプシ用TSVコピー
          </button>

          <button
            onClick={onExportJson}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-200 font-medium flex items-center gap-1.5 transition shadow-xs"
            title="Mini-JSONをクリップボードにコピー"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            JSONコピー
          </button>
        </div>

        {/* やり直す（Undo）ボタン */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition shadow-xs ${
              canUndo
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
                : "bg-slate-800/40 text-slate-500 border border-slate-700/40 cursor-not-allowed"
            }`}
            title="直前の操作をやり直す / 元に戻す (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-sky-400" />
            やり直す
          </button>
        )}

        {/* 設定ボタン */}
        {onOpenSettingsModal && (
          <button
            onClick={onOpenSettingsModal}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md text-xs text-slate-200 font-medium flex items-center gap-1.5 transition shadow-xs"
            title="基本設定 ＆ タグマスター管理"
          >
            <Settings className="w-3.5 h-3.5 text-slate-300" />
            設定
          </button>
        )}

        {/* 印刷（PDF化）ボタン */}
        <button
          onClick={onPrint || (() => window.print())}
          className="ml-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          印刷・PDF出力
        </button>
      </div>
    </header>
  );
};
