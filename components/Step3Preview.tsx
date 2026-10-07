"use client";

import React, { useState, useMemo } from "react";
import { QuizTest, Question } from "@/types/quiz";
import { MathText } from "./MathText";
import {
  RefreshCw,
  Edit3,
  Trash2,
  Printer,
  Check,
  Sparkles,
  Undo2,
  AlignJustify,
  FileText,
  Plus,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Scissors,
  ListFilter,
  Columns,
  Headphones,
  Image as ImageIcon,
  Link2,
  Unlink,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignRight,
  AlignCenter,
  Minus
} from "lucide-react";
import {
  extractSubQuestionLabels,
  extractSubQuestionAnswerMap,
  calculateSubQuestionLineWidth,
  calculateSingleAnswerLineWidth,
  calculateSameLineAnswerWidth,
  calculateVisualTextLength,
  isSameLineEligible,
  getSubQuestionLineWidthClass,
  isSymbolLabel,
  resolveAnswerLayout
} from "@/lib/answerUtils";
import { analyzeAnswerFieldStructure } from "@/lib/answerFieldEngine";
import { groupSectionsByPage } from "@/lib/pageUtils";
import { parseSubItems } from "@/lib/subItemUtils";

interface Step3PreviewProps {
  test: QuizTest;
  sheetMode: "student" | "teacher";
  onUpdateTitle: (newTitle: string) => void;
  onUpdateSectionTitle: (secIdx: number, newTitle: string) => void;
  onAutoGenerateSectionTitle?: (secIdx: number) => void;
  onSwapQuestion: (secIdx: number, qIdx: number) => void;
  onEditQuestion: (secIdx: number, qIdx: number, q: Question) => void;
  onOpenSubItemEditor?: (secIdx: number, qIdx: number, q: Question) => void;
  onDeleteQuestion: (secIdx: number, qIdx: number) => void;
  onToggleAnswerLayout?: (secIdx: number, qIdx: number) => void;
  onMergeWithNextSection?: (secIdx: number) => void;
  onUnmergeSection?: (secIdx: number) => void;
  onMergeQuestions?: (secIdx: number, qIdx: number) => void;
  onUnmergeQuestion?: (secIdx: number, qIdx: number) => void;
  onSplitSectionAt?: (secIdx: number, qIdx: number) => void;
  onMoveQuestion?: (secIdx: number, qIdx: number, direction: "up" | "down") => void;
  onAdjustAnswerWidth?: (secIdx: number, qIdx: number, delta: number) => void;
  onToggleAnswerAlign?: (secIdx: number, qIdx: number) => void;
  onGenerateSimilarPrompt?: (q: Question) => void;
  onUpdateSectionPage?: (secIdx: number, page: number) => void;
  onAddNewPageSection?: () => void;
  onToggleSectionLayout?: (secIdx: number) => void;
  onToggleItemColumns?: (secIdx: number, qIdx: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const Step3Preview: React.FC<Step3PreviewProps> = ({
  test,
  sheetMode,
  onUpdateTitle,
  onUpdateSectionTitle,
  onAutoGenerateSectionTitle,
  onSwapQuestion,
  onEditQuestion,
  onOpenSubItemEditor,
  onDeleteQuestion,
  onToggleAnswerLayout,
  onMergeWithNextSection,
  onUnmergeSection,
  onMergeQuestions,
  onUnmergeQuestion,
  onSplitSectionAt,
  onMoveQuestion,
  onAdjustAnswerWidth,
  onToggleAnswerAlign,
  onGenerateSimilarPrompt,
  onUpdateSectionPage,
  onAddNewPageSection,
  onToggleSectionLayout,
  onToggleItemColumns,
  onUndo,
  canUndo = false
}) => {
  // 用紙モード: A4縦（1枚ずつ） または B4見開き（2in1見開き）
  const [paperMode, setPaperMode] = useState<"a4" | "b4">("a4");
  // 全画面プレビューモーダル
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  // プレビューのズーム（全体フィット ⇄ 等倍100%）
  const [a4Zoom, setA4Zoom] = useState<"fit" | "100%">("fit");
  const [b4Zoom, setB4Zoom] = useState<"fit" | "100%">("fit");

  // 印刷・PDF出力ハンドラー（ブラウザがPDF初期ファイル名に使用する document.title を確実にテスト名に設定）
  const handlePrint = () => {
    if (test?.title) {
      document.title = test.title;
    }
    window.print();
  };

  // 各大問をページごとに自動・手動グルーピング（用紙サイズ・解答表示モードに合わせた最適分割）
  const pageMap = groupSectionsByPage(test.sections, { sheetMode, paperMode });
  const totalPages = Math.max(1, ...Array.from(pageMap.keys()));
  const pageNumbers = Array.from(pageMap.keys()).sort((a, b) => a - b);

  // B4見開き用の2ページペアリング
  const b4Spreads = useMemo(() => {
    const spreads: { leftPage: number; rightPage?: number }[] = [];
    for (let i = 0; i < pageNumbers.length; i += 2) {
      spreads.push({
        leftPage: pageNumbers[i],
        rightPage: pageNumbers[i + 1]
      });
    }
    return spreads;
  }, [pageNumbers]);

  /**
   * 単一ページの内容（ヘッダー + 大問群 + フッター）を描画
   */
  const renderPageContent = (page: number, isB4Half = false) => {
    const itemsOnThisPage = pageMap.get(page) || [];
    const isFirstPage = page === 1;

    return (
      <div className={`flex flex-col justify-between h-full ${isB4Half ? "overflow-visible text-[10px]" : "text-[11px]"}`}>
        {/* 上部ヘッダー */}
        <div>
          {isFirstPage ? (
            /* 第1ページ: フルヘッダー */
            <div className={`border-b-2 border-slate-900 ${isB4Half ? "pb-1.5 mb-2" : "pb-2 mb-3"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <input
                  type="text"
                  value={test.title}
                  onChange={e => onUpdateTitle(e.target.value)}
                  className={`font-extrabold tracking-tight font-serif bg-transparent hover:bg-slate-50 focus:bg-white border-b border-dashed border-transparent hover:border-slate-400 focus:border-indigo-600 focus:outline-none flex-1 py-0.5 transition ${
                    isB4Half ? "text-sm" : "text-base"
                  }`}
                  placeholder="テストタイトルを入力..."
                  title="クリックしてタイトルを編集"
                />
                <div className={`${isB4Half ? "text-[9px]" : "text-[10px]"} text-slate-700 shrink-0 font-medium space-x-2`}>
                  <span>時間: 30分</span>
                  <span>配点: {test.totalTargetPoints}点</span>
                </div>
              </div>

              {/* 受験者情報欄 */}
              <div className={`flex items-center justify-between mt-1 text-slate-800 ${isB4Half ? "text-[9px]" : "text-[10px]"}`}>
                <div className="space-x-3">
                  <span>組: ______</span>
                  <span>番: ____</span>
                  <span>氏名: _________________________</span>
                </div>
                <div className={`font-bold border border-slate-400 px-2 py-0.5 rounded ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                  得点: ______ / 100
                </div>
              </div>
            </div>
          ) : (
            /* 第2ページ以降: ミニヘッダー */
            <div className={`border-b border-slate-800 ${isB4Half ? "pb-1 mb-2" : "pb-1 mb-2.5"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div className={`font-extrabold font-serif text-slate-900 truncate ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                  {test.title}
                </div>
                <div className={`flex items-center gap-3 text-slate-700 font-medium shrink-0 ${isB4Half ? "text-[8.5px]" : "text-[9px]"}`}>
                  <span>氏名: _________________________</span>
                  <span className="bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded font-bold">
                    第 {page} ページ
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 大問・設問リスト */}
          <div className={isB4Half ? "space-y-2" : "space-y-3"}>
            {itemsOnThisPage.length === 0 ? (
              <div className="no-print text-center py-10 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                このページにはまだ問題がありません。左のプールまたはSTEP 2から問題を追加してください。
              </div>
            ) : (
              itemsOnThisPage.map(({ section: sec, secIdx, questions, isContinuation, questionOffset }) => {
                const activeQuestions = questions || sec.questions;
                if (activeQuestions.length === 0 && !isContinuation) return null;
                return (
                  <div key={`${sec.id || secIdx}-${questionOffset ?? 0}`} className="question-block">
                    {/* 大問見出し（紙面上で直接打ち替え可能 ＆ 論点自動入力 ＆ ページ移動） */}
                    <div className="flex items-baseline justify-between border-b border-slate-800 pb-0.5 mb-1 group/header relative">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                        <input
                          type="text"
                          value={sec.title}
                          onChange={e => onUpdateSectionTitle(secIdx, e.target.value)}
                          className="font-bold text-[11px] text-slate-900 tracking-tight font-serif bg-transparent hover:bg-slate-50 focus:bg-white border-b border-dashed border-transparent hover:border-slate-400 focus:border-indigo-600 focus:outline-none w-full py-0.5 transition"
                          placeholder="大問タイトルを入力..."
                          title="クリックして大問名を編集"
                        />
                        {isContinuation && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0 select-none">
                            （続き）
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onAutoGenerateSectionTitle && (
                          <button
                            type="button"
                            onClick={() => onAutoGenerateSectionTitle(secIdx)}
                            className="no-print opacity-0 group-hover/header:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            title="設問の論点から題名を自動入力"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                          </button>
                        )}
                        {/* マージ解除ボタン（マージされている場合） */}
                        {onUnmergeSection && sec.mergedSectionTitles && sec.mergedSectionTitles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onUnmergeSection(secIdx)}
                            className="no-print opacity-0 group-hover/header:opacity-100 px-1 py-0.2 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 transition cursor-pointer flex items-center gap-0.5 shadow-2xs"
                            title="マージを解除して元の各大問に分割・復元"
                          >
                            <Unlink className="w-2.5 h-2.5 text-amber-700" />
                            <span>マージ解除</span>
                          </button>
                        )}
                        {/* 下の大問とマージボタン（次の大問がある場合） */}
                        {onMergeWithNextSection && secIdx < test.sections.length - 1 && (
                          <button
                            type="button"
                            onClick={() => onMergeWithNextSection(secIdx)}
                            className="no-print opacity-0 group-hover/header:opacity-100 px-1 py-0.2 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition cursor-pointer flex items-center gap-0.5 shadow-2xs"
                            title="下の大問とマージして1つの大問に統合（元データは保持）"
                          >
                            <Link2 className="w-2.5 h-2.5 text-indigo-600" />
                            <span>下とマージ</span>
                          </button>
                        )}
                        {onToggleSectionLayout && (
                          <button
                            type="button"
                            onClick={() => onToggleSectionLayout(secIdx)}
                            className={`no-print opacity-0 group-hover/header:opacity-100 px-1.5 py-0.2 text-[9px] font-bold rounded border transition cursor-pointer flex items-center gap-0.5 ${
                              sec.layout === "2col"
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                            title="大問内の設問配置を切替（1列 ⇄ 2列グリッド：英単語・短問に最適）"
                          >
                            <Columns className="w-2.5 h-2.5" />
                            <span>{sec.layout === "2col" ? "2列中" : "1列"}</span>
                          </button>
                        )}
                        {onUpdateSectionPage && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetP = page === 1 ? 2 : 1;
                              onUpdateSectionPage(secIdx, targetP);
                            }}
                            className="no-print opacity-0 group-hover/header:opacity-100 px-1 py-0.2 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition cursor-pointer"
                            title={`この大問を第${page === 1 ? 2 : 1}ページへ移動`}
                          >
                            📄 {page === 1 ? "2Pへ" : "1Pへ"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 各設問（2列モード時は左右2列グリッド、1列モード時は縦並び） */}
                    {(() => {
                      // 自動判定: 全設問が40文字以下かつ画像・図形なし、または明示的に 2col が指定されている場合
                      const isShortVocabularySection = activeQuestions.length >= 2 && activeQuestions.every(
                        q => q.questionText.length <= 42 && !q.figureSvg && !q.imageUrl && !q.audioUrl && !q.hasImagePlaceholder
                      );
                      const is2Col = sec.layout === "2col" || (sec.layout !== "1col" && isShortVocabularySection);

                      return (
                        <div
                          className={
                            is2Col
                              ? `grid grid-cols-2 gap-x-6 ${isB4Half ? "gap-y-1" : "gap-y-1.5"}`
                              : (isB4Half ? "space-y-1" : "space-y-1.5")
                          }
                        >
                          {activeQuestions.map((q, localQIdx) => {
                            const qIdx = (questionOffset ?? 0) + localQIdx;
                            return (
                              <div
                                key={q.id || `${secIdx}-${qIdx}`}
                                className={`question-block leading-snug relative group p-1 -m-1 rounded hover:bg-slate-50 transition border border-transparent hover:border-slate-200 ${
                                  isB4Half ? "text-[10px]" : "text-[11px]"
                                }`}
                              >
                          {/* ホバー直接操作ツールバー */}
                          <div className="no-print preview-action-btn absolute right-1 -top-2 hidden group-hover:flex flex-wrap items-center justify-end gap-1 bg-white/95 backdrop-blur border border-slate-300 rounded shadow-md px-1.5 py-0.5 z-30 max-w-[calc(100%-8px)]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSwapQuestion(secIdx, qIdx);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded cursor-pointer transition"
                              title="この問題を別候補に差し替え"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditQuestion(secIdx, qIdx, q);
                              }}
                              className="text-slate-600 hover:text-slate-900 p-1 hover:bg-slate-100 rounded cursor-pointer transition"
                              title="この問題を直接編集"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenSubItemEditor) {
                                  onOpenSubItemEditor(secIdx, qIdx, q);
                                } else {
                                  onEditQuestion(secIdx, qIdx, q);
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded cursor-pointer transition"
                              title="大問内の枝問（小問）を編集・追加・削除・選択リナンバリング"
                            >
                              <ListFilter className="w-3.5 h-3.5" />
                            </button>
                            {/* 小問の上下移動ボタン */}
                            {onMoveQuestion && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveQuestion(secIdx, qIdx, "up");
                                  }}
                                  disabled={secIdx === 0 && qIdx === 0}
                                  className="text-slate-500 hover:text-indigo-600 disabled:opacity-20 p-1 hover:bg-slate-100 rounded cursor-pointer transition"
                                  title="問題を上へ移動（先頭の場合は前の大問へ）"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveQuestion(secIdx, qIdx, "down");
                                  }}
                                  disabled={secIdx === test.sections.length - 1 && qIdx === sec.questions.length - 1}
                                  className="text-slate-500 hover:text-indigo-600 disabled:opacity-20 p-1 hover:bg-slate-100 rounded cursor-pointer transition"
                                  title="問題を下へ移動（末尾の場合は次の大問へ）"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {/* ここで大問分割 */}
                            {onSplitSectionAt && qIdx > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSplitSectionAt(secIdx, qIdx);
                                }}
                                className="text-amber-600 hover:text-amber-800 p-1 hover:bg-amber-50 rounded cursor-pointer transition"
                                title="この問題の前で大問を新規分割"
                              >
                                <Scissors className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* ★ 解答欄編集メニューグループ（幅調整・横位置・レイアウト形式） ★ */}
                            {(onAdjustAnswerWidth || onToggleAnswerAlign || onToggleAnswerLayout) && (
                              <div className="flex items-center gap-1 bg-indigo-50/80 border border-indigo-200/90 rounded px-1 py-0.2" title="解答用紙の解答欄編集メニュー">
                                <span className="text-[8px] font-bold text-indigo-700 select-none mr-0.5">解答欄:</span>
                                {/* 解答欄の長さ調整（短縮・延長） */}
                                {onAdjustAnswerWidth && (
                                  <div className="flex items-center border border-indigo-200 rounded px-0.5 bg-white">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAdjustAnswerWidth(secIdx, qIdx, -20);
                                      }}
                                      className="text-slate-600 hover:text-indigo-700 p-0.5 hover:bg-indigo-50 rounded transition cursor-pointer"
                                      title="解答欄の下線を短くする (-20px)"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="text-[8px] font-mono text-slate-500 px-0.5 select-none">幅</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAdjustAnswerWidth(secIdx, qIdx, 20);
                                      }}
                                      className="text-slate-600 hover:text-indigo-700 p-0.5 hover:bg-indigo-50 rounded transition cursor-pointer"
                                      title="解答欄の下線を長くする (+20px)"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}
                                {/* 解答欄の横位置切替（右寄せ / 左寄せ / 中央） */}
                                {onToggleAnswerAlign && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleAnswerAlign(secIdx, qIdx);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-white rounded cursor-pointer transition border border-transparent hover:border-indigo-200"
                                    title={`解答欄の配置位置を切替 (現在: ${
                                      q.answerAlign === "left" ? "左寄せ" : q.answerAlign === "center" ? "中央" : "右寄せ"
                                    })`}
                                  >
                                    {q.answerAlign === "left" ? (
                                      <AlignLeft className="w-3.5 h-3.5" />
                                    ) : q.answerAlign === "center" ? (
                                      <AlignCenter className="w-3.5 h-3.5" />
                                    ) : (
                                      <AlignRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                {/* 解答欄の形式切替（同一行 ⇄ 横並び ⇄ 各問1行記述） */}
                                {onToggleAnswerLayout && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleAnswerLayout(secIdx, qIdx);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-white rounded cursor-pointer transition border border-transparent hover:border-indigo-200"
                                    title="解答欄の形式を切替（同一行 ⇄ 横並び ⇄ 各問1行記述）"
                                  >
                                    <AlignJustify className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                            {onToggleItemColumns && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleItemColumns(secIdx, qIdx);
                                }}
                                className="text-slate-600 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded cursor-pointer transition"
                                title={q.itemColumns === 2 ? "小問の並びを1列（縦並び）に変更" : "小問の並びを2列（1行に2問並び）に変更"}
                              >
                                <Columns className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onGenerateSimilarPrompt && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGenerateSimilarPrompt(q);
                                }}
                                className="text-purple-600 hover:text-purple-800 p-1 hover:bg-purple-50 rounded cursor-pointer transition"
                                title="この問題の類題プロンプトを作成"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* 小問マージ解除ボタン */}
                            {onUnmergeQuestion && q.mergedQuestions && q.mergedQuestions.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUnmergeQuestion(secIdx, qIdx);
                                }}
                                className="text-amber-600 hover:text-amber-800 p-1 hover:bg-amber-50 rounded cursor-pointer transition"
                                title="小問マージを解除して元の問題に復元"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* 下の問題とマージボタン */}
                            {onMergeQuestions && qIdx < sec.questions.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMergeQuestions(secIdx, qIdx);
                                }}
                                className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-50 rounded cursor-pointer transition"
                                title="下の問題とマージして連番化"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteQuestion(secIdx, qIdx);
                              }}
                              className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded cursor-pointer transition"
                              title="この問題をテストから削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {(() => {
                            // 解答欄構造エンジンの包括解析
                            const answerStruct = analyzeAnswerFieldStructure(
                              q.questionText,
                              q.answer,
                              q.explanation,
                              q.answerLabels,
                              q.answerLayout
                            );

                            const subLabels = (answerStruct.type === "cloze-passage" || answerStruct.type === "multi-part")
                              ? answerStruct.globalLabels
                              : extractSubQuestionLabels(q.questionText, q.answer, q.answerLabels);
                            const hasMedia = Boolean(
                              (q.figureSvg && q.figureSvg.trim().length > 0) ||
                              (q.imageUrl && q.imageUrl.trim().length > 0) ||
                              (q.audioUrl && q.audioUrl.trim().length > 0) ||
                              q.hasImagePlaceholder
                            );

                            // 文中の空所記号（行頭の設問番号ではなく、文中の空所 ( ① ) や ( 1 ) 等）を検出
                            const bodyWithoutLeadingNum = q.questionText.replace(/^[・\-\*]?\s*(?:[（\(][0-9０-９]+[）\)]|[①-⑳]|[0-9]+[\.．])\s*/, "");
                            const blankInQMatch = bodyWithoutLeadingNum.match(/[（\(]\s*([①-⑳0-9０-９]+)\s*[）\)]/);
                            const detectedBlankLabel = blankInQMatch ? blankInQMatch[1] : null;

                            const isSameLine = isSameLineEligible({
                              questionText: q.questionText,
                              answer: q.answer,
                              subLabels,
                              is2Col,
                              hasMedia,
                              configuredLayout: q.answerLayout,
                            });

                            if (isSameLine) {
                              return (
                                <div className="space-y-0.5">
                                  <div className="flex items-baseline justify-between gap-4 sm:gap-6">
                                    {/* 問題番号 + 問題文（同一行） */}
                                    <div className="text-slate-950 font-serif leading-relaxed flex items-baseline gap-1 min-w-0 flex-1">
                                      <span className={`font-bold mr-1 inline-block shrink-0 select-none ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                                        ({qIdx + 1})
                                      </span>
                                      {q.selectedSubItemIndices ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenSubItemEditor) {
                                              onOpenSubItemEditor(secIdx, qIdx, q);
                                            } else {
                                              onEditQuestion(secIdx, qIdx, q);
                                            }
                                          }}
                                          className="no-print bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                          title="クリックして枝問（小問）を編集・再採番"
                                        >
                                          {q.selectedSubItemIndices.length}問抽出
                                        </button>
                                      ) : parseSubItems(q.questionText).hasSubItems ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenSubItemEditor) {
                                              onOpenSubItemEditor(secIdx, qIdx, q);
                                            } else {
                                              onEditQuestion(secIdx, qIdx, q);
                                            }
                                          }}
                                          className="no-print bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                          title="クリックして枝問（小問）を削る・再採番"
                                        >
                                          枝問 {parseSubItems(q.questionText).items.length}問
                                        </button>
                                      ) : null}
                                      <span className="break-words">
                                        <MathText text={q.questionText} />
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-sans ml-1 select-none shrink-0 print:hidden">
                                        [{q.defaultPoints}点]
                                      </span>
                                    </div>

                                    {/* 同一行解答欄（生徒用または教師用） */}
                                    {sheetMode === "student" ? (
                                      <div className="shrink-0 flex items-end gap-1.5 self-end pb-0.5">
                                        <span className="text-[9.5px] text-slate-600 font-bold shrink-0 pb-0.5">
                                          {detectedBlankLabel
                                            ? (isSymbolLabel(detectedBlankLabel) ? detectedBlankLabel : `(${detectedBlankLabel})`)
                                            : subLabels.length === 1 && !isSymbolLabel(subLabels[0])
                                            ? `[${subLabels[0]}]`
                                            : "答"}
                                        </span>
                                        <div
                                          className="answer-underline border-b border-slate-700 transition-all cursor-pointer hover:border-indigo-600 hover:border-b-2"
                                          style={{ width: `${q.customLineWidth || calculateSameLineAnswerWidth(q.answer, is2Col)}px` }}
                                          title="クリックで解答欄の形式を切替（同一行 ⇄ 横並び ⇄ 各問1行）/ 上部メニューで幅調整可能"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onToggleAnswerLayout) onToggleAnswerLayout(secIdx, qIdx);
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="shrink-0 max-w-[55%]">
                                        <div className="bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] leading-tight flex items-baseline gap-1 text-rose-800 font-bold">
                                          <span className="text-[7px] bg-rose-200 px-1 py-0.2 rounded text-rose-900 shrink-0">
                                            {detectedBlankLabel || "模範解答"}
                                          </span>
                                          <span className="break-words">
                                            <MathText text={q.answer} />
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* 教師用：同一行配置で解説がある場合の表示 */}
                                  {sheetMode === "teacher" && q.explanation && (
                                    <div className="text-[8px] text-slate-600 pl-4 border-l-2 border-rose-200 mt-0.5">
                                      <MathText text={q.explanation} />
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // 複数行小問の解析（※オフにした枝問が表示されないよう、必ず間引き後の現在の questionText をパース）
                            const parsedSub = parseSubItems(
                              q.questionText,
                              q.answer,
                              q.explanation
                            );

                            // ★ パターン1: 親小問・子空所ブロック型（block-blanks） ★
                            // (1)〜(4) などの各小問ブロックの直下に、所属する空所（①〜⑭）の解答欄を連動配置
                            if (answerStruct.type === "block-blanks" && answerStruct.blockItems && answerStruct.blockItems.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  {/* 大問設問ヘッダー部 */}
                                  <div className="text-slate-950 font-serif leading-relaxed flex items-baseline gap-1">
                                    <span className={`font-bold mr-1 inline-block select-none shrink-0 ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                                      ({qIdx + 1})
                                    </span>
                                    {q.selectedSubItemIndices ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                        title="クリックして枝問（小問）を編集・再採番"
                                      >
                                        {q.selectedSubItemIndices.length}問抽出
                                      </button>
                                    ) : parseSubItems(q.originalQuestionText || q.questionText).hasSubItems ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                        title="クリックして枝問（小問）を削る・再採番"
                                      >
                                        枝問 {parseSubItems(q.originalQuestionText || q.questionText).items.length}問
                                      </button>
                                    ) : null}
                                    {parsedSub.leadInText ? (
                                      <span className="font-medium">
                                        <MathText text={parsedSub.leadInText} />
                                      </span>
                                    ) : null}
                                    <span className="text-[9px] text-slate-400 font-sans ml-1.5 select-none print:hidden shrink-0">
                                      [{q.defaultPoints}点]
                                    </span>
                                  </div>

                                  {/* 各親小問ブロック（本文 + 所属空所の解答欄） */}
                                  <div className={`space-y-2.5 ${isB4Half ? "pl-2" : "pl-3"} mt-1`}>
                                    {answerStruct.blockItems.map((block, bIdx) => {
                                      return (
                                        <div key={bIdx} className="space-y-1">
                                          {/* 親小問テキスト */}
                                          <div className="text-slate-950 font-serif leading-relaxed">
                                            <MathText text={block.rawText} />
                                          </div>

                                          {/* この親小問に属する空所解答欄 */}
                                          {block.blankLabels.length > 0 && (
                                            <div className={`mt-0.5 ${isB4Half ? "pl-2" : "pl-3"}`}>
                                              {sheetMode === "student" ? (
                                                <div className="flex flex-wrap items-end gap-x-5 gap-y-1 py-0.5">
                                                  {block.blankLabels.map((bLbl, blIdx) => {
                                                    const ansText = block.blankAnswerMap.get(bLbl) || "";
                                                    const lineWidth = q.customLineWidth || calculateSubQuestionLineWidth(ansText, block.blankLabels.length, 2);
                                                    return (
                                                      <div key={blIdx} className="flex items-end gap-1.5 text-[10.5px] text-slate-900">
                                                        <span className="font-bold shrink-0 text-slate-800 min-w-[18px] pb-0.5">
                                                          {bLbl}
                                                        </span>
                                                        <div
                                                          className="answer-underline border-b border-slate-700 transition-all inline-block"
                                                          style={{ width: `${lineWidth}px` }}
                                                        />
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ) : (
                                                <div className="flex flex-wrap items-center gap-2 py-0.5">
                                                  {block.blankLabels.map((bLbl, blIdx) => {
                                                    const ansText = block.blankAnswerMap.get(bLbl) || "";
                                                    return (
                                                      <div key={blIdx} className="bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] text-rose-800 font-bold flex items-baseline gap-1">
                                                        <span className="text-[7px] bg-rose-200 px-1 py-0.2 rounded text-rose-900 shrink-0">
                                                          {bLbl}
                                                        </span>
                                                        <span className="break-words font-serif">
                                                          <MathText text={ansText} />
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* 教師用解説 */}
                                  {sheetMode === "teacher" && q.explanation && (
                                    <div className="text-[8px] text-slate-600 pl-4 border-l-2 border-rose-200 mt-1">
                                      <MathText text={q.explanation} />
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // 各小問アイテム行のすぐ右隣に解答欄を設ける（item-inline）適格判定：
                            // 箇条書き・空所型（例: "・billion：( ① )"）または各行が短答の英単語などの場合に適用
                            const isItemInlineEligible = parsedSub.hasSubItems && !hasMedia && q.answerLayout !== "stacked" && (() => {
                              const maxLineLen = Math.max(...parsedSub.items.map(item => calculateVisualTextLength(item.promptText || item.rawLine)));
                              const hasBlankPatterns = parsedSub.items.some(item =>
                                item.rawLine.includes("：") || item.rawLine.includes(":") || item.rawLine.startsWith("・") || /[（\(]\s*[①-⑳0-9０-９]+\s*[）\)]/.test(item.rawLine)
                              );
                              const threshold = is2Col ? 24 : 38;
                              return maxLineLen <= threshold || hasBlankPatterns;
                            })();

                            if (isItemInlineEligible) {
                              return (
                                <div className="space-y-1">
                                  {/* 大問設問ヘッダー部 */}
                                  <div className="text-slate-950 font-serif leading-relaxed flex items-baseline gap-1">
                                    <span className={`font-bold mr-1 inline-block select-none shrink-0 ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                                      ({qIdx + 1})
                                    </span>
                                    {q.selectedSubItemIndices ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                        title="クリックして枝問（小問）を編集・再採番"
                                      >
                                        {q.selectedSubItemIndices.length}問抽出
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition shrink-0"
                                        title="クリックして枝問（小問）を削る・再採番"
                                      >
                                        枝問 {parsedSub.items.length}問
                                      </button>
                                    )}
                                    {parsedSub.leadInText ? (
                                      <span className="font-medium">
                                        <MathText text={parsedSub.leadInText} />
                                      </span>
                                    ) : null}
                                    <span className="text-[9px] text-slate-400 font-sans ml-1.5 select-none print:hidden shrink-0">
                                      [{q.defaultPoints}点]
                                    </span>
                                  </div>

                                  {/* 各小問行をレンダリング（単語問題・短問は2列グリッドで中央余白を解消） */}
                                  {(() => {
                                    const maxItemLen = Math.max(...parsedSub.items.map(item => calculateVisualTextLength(item.promptText || item.rawLine)));
                                    // 2列並び判定: 明示的に2列指定、または大問が1列かつ3問以上で各単語がコンパクトな場合
                                    const isGrid2Col = q.itemColumns === 2 || (q.itemColumns !== 1 && !is2Col && parsedSub.items.length >= 3 && maxItemLen <= 26);

                                    return (
                                      <div className={isGrid2Col ? `grid grid-cols-2 gap-x-6 ${isB4Half ? "gap-y-0.5 pl-2" : "gap-y-1 pl-3"}` : `space-y-1 ${isB4Half ? "pl-2" : "pl-4"}`}>
                                        {parsedSub.items.map((item, itemIdx) => {
                                          const itemLineWidth = q.customLineWidth || calculateSameLineAnswerWidth(item.answerText || "", is2Col || isGrid2Col);
                                          return (
                                            <div key={itemIdx} className="flex items-baseline justify-between gap-4 sm:gap-6 py-0.5">
                                              <div className="text-slate-950 font-serif leading-relaxed flex-1 min-w-0">
                                                <MathText text={item.promptText || item.rawLine} />
                                              </div>

                                              {/* 各行の右隣解答欄 */}
                                              {sheetMode === "student" ? (
                                                <div className="shrink-0 flex items-end gap-1.5 self-end pb-0.5">
                                                  <span className="text-[9.5px] text-slate-600 font-bold shrink-0 pb-0.5">
                                                    {item.originalLabel}
                                                  </span>
                                                  <div
                                                    className="answer-underline border-b border-slate-700 transition-all"
                                                    style={{ width: `${itemLineWidth}px` }}
                                                  />
                                                </div>
                                              ) : (
                                                <div className="shrink-0 max-w-[50%]">
                                                  <div className="bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] text-rose-800 font-bold flex items-baseline gap-1">
                                                    <span className="text-[7px] bg-rose-200 px-1 py-0.2 rounded text-rose-900 shrink-0">
                                                      {item.originalLabel}
                                                    </span>
                                                    <span className="break-words">
                                                      <MathText text={item.answerText || ""} />
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}

                                  {/* 教師用解説 */}
                                  {sheetMode === "teacher" && q.explanation && (
                                    <div className="text-[8px] text-slate-600 pl-4 border-l-2 border-rose-200 mt-0.5">
                                      <MathText text={q.explanation} />
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  {/* 問題番号 + 問題文 */}
                                  <div className="text-slate-950 font-serif leading-relaxed">
                                    <span className={`font-bold mr-1 inline-block select-none ${isB4Half ? "text-[10px]" : "text-[11px]"}`}>
                                      ({qIdx + 1})
                                    </span>
                                    {q.selectedSubItemIndices ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition"
                                        title="クリックして枝問（小問）を編集・再採番"
                                      >
                                        {q.selectedSubItemIndices.length}問抽出
                                      </button>
                                    ) : parseSubItems(q.originalQuestionText || q.questionText).hasSubItems ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenSubItemEditor) {
                                            onOpenSubItemEditor(secIdx, qIdx, q);
                                          } else {
                                            onEditQuestion(secIdx, qIdx, q);
                                          }
                                        }}
                                        className="no-print bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-sans text-[8.5px] font-bold px-1 py-0.2 rounded border border-indigo-200 mr-1 select-none cursor-pointer transition"
                                        title="クリックして枝問（小問）を削る・再採番"
                                      >
                                        枝問 {parseSubItems(q.originalQuestionText || q.questionText).items.length}問
                                      </button>
                                    ) : null}
                                    <MathText text={q.questionText} />
                                    <span className="text-[9px] text-slate-400 font-sans ml-1.5 select-none print:hidden">
                                      [{q.defaultPoints}点]
                                    </span>
                                  </div>

                                  {/* 画面用インライン音声プレイヤー（印刷時は非表示） */}
                                  {q.audioUrl && (
                                    <div className="mt-1 mb-0.5 print:hidden flex items-center gap-1.5 bg-indigo-50/80 border border-indigo-200 rounded px-2 py-0.5 max-w-xs">
                                      <Headphones className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span className="text-[9px] font-bold text-indigo-700 shrink-0">リスニング:</span>
                                      <audio controls src={q.audioUrl} className="h-5 flex-1 text-xs" />
                                    </div>
                                  )}

                                  {/* 生徒用解答欄 または 教師用模範解答 */}
                                  {sheetMode === "student" ? (
                                    (() => {
                                      const layout = resolveAnswerLayout(q.answerLayout, q.questionText, q.answer, subLabels);

                                      if (layout === "stacked") {
                                        return (
                                          <div className="mt-2.5 space-y-2 pl-2">
                                            {subLabels.length > 0 ? (
                                              subLabels.map((lbl, lIdx) => (
                                                <div key={lIdx} className="flex items-end gap-1.5 text-[10.5px] text-slate-900">
                                                  <span className="font-bold shrink-0 text-slate-800 min-w-[26px] pb-0.5">
                                                    {isSymbolLabel(lbl) ? lbl : `[${lbl}]`}
                                                  </span>
                                                  <span
                                                    className="flex-1 answer-underline border-b border-slate-700 cursor-pointer hover:border-indigo-600 hover:border-b-2 transition-all"
                                                    title="クリックで解答欄の形式を切替（各問1行 ⇄ 同一行 ⇄ 横並び）"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (onToggleAnswerLayout) onToggleAnswerLayout(secIdx, qIdx);
                                                    }}
                                                  ></span>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="flex items-end gap-1.5 text-[10.5px] text-slate-900">
                                                <span className="font-bold shrink-0 text-slate-800 pb-0.5">答</span>
                                                <span
                                                    className="flex-1 answer-underline border-b border-slate-700 cursor-pointer hover:border-indigo-600 hover:border-b-2 transition-all"
                                                    title="クリックで解答欄の形式を切替（各問1行 ⇄ 同一行 ⇄ 横並び）"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (onToggleAnswerLayout) onToggleAnswerLayout(secIdx, qIdx);
                                                    }}
                                                  ></span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      const maxLabelLen = subLabels.reduce((max, l) => Math.max(max, l.length), 0);
                                      const ansMap = extractSubQuestionAnswerMap(q.answer, subLabels);

                                      // ★ 同一設問内の小問解答欄の幅を統一（全小問の最大幅に合わせてバラつきを解消） ★
                                      const baseUniformWidth = subLabels.length > 0
                                        ? Math.max(
                                            ...subLabels.map(lbl =>
                                              calculateSubQuestionLineWidth(
                                                ansMap.get(lbl) || "",
                                                subLabels.length,
                                                maxLabelLen
                                              )
                                            )
                                          )
                                        : calculateSingleAnswerLineWidth(q.answer);

                                      const effectiveWidth = q.customLineWidth || baseUniformWidth;
                                      const alignClass = q.answerAlign === "left" ? "justify-start" : q.answerAlign === "center" ? "justify-center" : "justify-end";

                                      return (
                                        <div className={`pt-2.5 flex ${alignClass}`}>
                                          {subLabels.length > 0 ? (
                                            <div className={`flex flex-wrap items-end ${alignClass} gap-x-4 gap-y-1.5`}>
                                              <span className="text-[9.5px] text-slate-600 font-bold shrink-0 pb-0.5">答</span>
                                              {subLabels.map((lbl, lIdx) => {
                                                const isSymbol = isSymbolLabel(lbl);

                                                return (
                                                  <div key={lIdx} className="flex items-end gap-1.5 shrink-0">
                                                    <span className="text-[10px] font-bold text-slate-800 pb-0.5">
                                                      {isSymbol ? lbl : `[${lbl}]`}
                                                    </span>
                                                    <div
                                                      className="answer-underline border-b border-slate-700 transition-all cursor-pointer hover:border-indigo-600 hover:border-b-2"
                                                      style={{ width: `${effectiveWidth}px` }}
                                                      title="クリックで解答欄の形式を切替（横並び ⇄ 各問1行 ⇄ 同一行）/ 上部メニューで幅調整可能"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onToggleAnswerLayout) onToggleAnswerLayout(secIdx, qIdx);
                                                      }}
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          ) : (
                                            <div className="flex items-end gap-1.5">
                                              <span className="text-[9.5px] text-slate-600 font-bold pb-0.5">答</span>
                                              <div
                                                className="answer-underline border-b border-slate-700 transition-all"
                                                style={{ width: `${effectiveWidth}px` }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="mt-0.5 space-y-1">
                                      <div className="bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-[9px] leading-tight">
                                        <div className="flex items-center gap-1 text-rose-800 font-bold">
                                          <span className="text-[7px] bg-rose-200 px-1 py-0.2 rounded text-rose-900 shrink-0">
                                            模範解答
                                          </span>
                                          <span>
                                            <MathText text={q.answer} />
                                          </span>
                                        </div>
                                        {q.explanation && (
                                          <div className="text-[8px] text-slate-600 mt-0.5 pl-1 border-l border-rose-300">
                                            <MathText text={q.explanation} />
                                          </div>
                                        )}
                                      </div>

                                      {/* 教師用：リスニング放送台本（原稿）の印字 */}
                                      {q.audioScript && (
                                        <div className="bg-amber-50/70 border border-amber-200/90 rounded px-1.5 py-0.5 text-[8.5px] leading-tight text-slate-800 font-sans">
                                          <div className="font-bold text-amber-900 flex items-center gap-1 mb-0.5 text-[8px]">
                                            <Headphones className="w-2.5 h-2.5 text-amber-700" />
                                            <span>【放送台本 / スクリプト】</span>
                                          </div>
                                          <div className="whitespace-pre-wrap pl-1 border-l-2 border-amber-400 text-slate-700 font-mono text-[8px]">
                                            {q.audioScript}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* SVG図形 または アップロード画像 または 画像欄 */}
                                {(q.figureSvg || q.imageUrl || q.hasImagePlaceholder) && (
                                  <div className="shrink-0 bg-white p-0.5 rounded border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    {q.figureSvg && (
                                      <div dangerouslySetInnerHTML={{ __html: q.figureSvg }} />
                                    )}
                                    {q.imageUrl && (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img
                                        src={q.imageUrl}
                                        alt="設問図"
                                        className="max-h-24 max-w-[130px] object-contain rounded"
                                      />
                                    )}
                                    {/* 絵を見て答える問題用 画像欄枠 */}
                                    {q.hasImagePlaceholder && !q.imageUrl && (
                                      <div className="w-28 h-20 border-2 border-dashed border-slate-400 print:border-slate-600 rounded flex flex-col items-center justify-center bg-slate-50/60 print:bg-white text-slate-500 print:text-slate-700 select-none p-1">
                                        <ImageIcon className="w-5 h-5 mb-0.5 opacity-60 print:opacity-80" />
                                        <span className="text-[10px] font-bold tracking-wider">画像欄</span>
                                        {q.imagePlaceholderText && q.imagePlaceholderText !== "画像欄" && (
                                          <span className="text-[8px] text-slate-500 print:text-slate-800 mt-0.5 truncate max-w-full text-center px-1 font-sans">
                                            {q.imagePlaceholderText}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    </div>
                  );
                })()}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ページフッター: 通しページ番号 */}
        <div className="pt-2 text-center text-[10px] text-slate-400 font-mono tracking-widest border-t border-slate-100 print:border-transparent mt-auto select-none">
          - {page} / {totalPages} -
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-200/80 print:bg-white print:h-auto print:overflow-visible print:block">
      {/* カラムヘッダー（STEP 3） */}
      <div className="no-print px-3 py-2 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-emerald-600 text-white shrink-0 shadow-2xs">
            STEP 3
          </span>
          <h2 className="text-xs font-bold text-emerald-950 truncate whitespace-nowrap" title="完成プレビュー ＆ 直接編集">
            完成プレビュー
          </h2>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200 shrink-0 whitespace-nowrap">
            全{totalPages}P
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 用紙レイアウト切替（A4縦 ⇄ B4横A4見開き） */}
          <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-300 shadow-2xs">
            <button
              type="button"
              onClick={() => setPaperMode("a4")}
              className={`px-1.5 py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                paperMode === "a4"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="A4縦（標準・1枚ずつ印刷）"
            >
              <span>📄</span>
              <span>A4</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperMode("b4")}
              className={`px-1.5 py-1 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                paperMode === "b4"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="B4横にA4を2ページ並べる見開きテスト用紙（中央二つ折り）"
            >
              <span>📑</span>
              <span>B4横</span>
            </button>
          </div>

          {/* A4時の表示補助（画面フィット切替 ＆ 全画面プレビュー） */}
          {paperMode === "a4" && (
            <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setA4Zoom(prev => (prev === "fit" ? "100%" : "fit"))}
                className="px-1.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer whitespace-nowrap"
                title={a4Zoom === "fit" ? "等倍(100%)で表示" : "画面幅にフィット"}
              >
                {a4Zoom === "fit" ? <ZoomIn className="w-3 h-3 text-emerald-600" /> : <ZoomOut className="w-3 h-3 text-emerald-600" />}
                <span>{a4Zoom === "fit" ? "フィット" : "100%"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMaximized(true)}
                className="px-1.5 py-1 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer whitespace-nowrap"
                title="全画面プレビューを開く"
              >
                <Maximize2 className="w-3 h-3 text-emerald-600" />
                <span>全画面</span>
              </button>
            </div>
          )}

          {/* B4見開き時の表示補助（画面フィット切替 ＆ 全画面見開き） */}
          {paperMode === "b4" && (
            <div className="flex items-center gap-0.5 bg-white rounded-lg p-0.5 border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setB4Zoom(prev => (prev === "fit" ? "100%" : "fit"))}
                className="px-1.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer whitespace-nowrap"
                title={b4Zoom === "fit" ? "等倍(100%)で表示" : "画面幅にフィット"}
              >
                {b4Zoom === "fit" ? <ZoomIn className="w-3 h-3 text-indigo-600" /> : <ZoomOut className="w-3 h-3 text-indigo-600" />}
                <span>{b4Zoom === "fit" ? "フィット" : "100%"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMaximized(true)}
                className="px-1.5 py-1 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer whitespace-nowrap"
                title="見開き全画面プレビューを開く"
              >
                <Maximize2 className="w-3 h-3 text-indigo-600" />
                <span>全画面</span>
              </button>
            </div>
          )}

          {onAddNewPageSection && (
            <button
              onClick={onAddNewPageSection}
              className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="新しいページ（大問枠）を追加"
            >
              <Plus className="w-3 h-3 text-emerald-600" />
              <span>+ページ</span>
            </button>
          )}

          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition ${
                canUndo
                  ? "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer"
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50"
              }`}
              title="直前の変更をやり直す / 元に戻す (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 text-sky-600" />
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>印刷・PDF</span>
          </button>
        </div>
      </div>

      {/* B4見開き印刷時に自動で用紙方向を「横（landscape）」に設定 */}
      {paperMode === "b4" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: landscape !important;
                  margin: 0mm !important;
                }
              }
            `
          }}
        />
      )}

      {/* プレビュー表示エリア（スクロール可能 ＆ 印刷時は全高展開） */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4 flex flex-col items-center print:p-0 print:m-0 print:overflow-visible print:block print:h-auto">
        {paperMode === "a4" ? (
          /* A4縦モード: 実寸210mm幅固定でレイアウト計算し、fit時はzoomで縮小（印刷と完全一致） */
          pageNumbers.map(page => (
            <div
              key={page}
              style={a4Zoom === "fit" ? { zoom: 0.68 } : undefined}
              className="a4-sheet bg-white text-slate-900 shadow-lg border border-slate-300 w-[210mm] min-w-[210mm] min-h-[297mm] px-[12mm] py-[10mm] flex flex-col justify-between mb-8 print:mb-0 print:shadow-none print:border-none print:w-full print:max-w-none print:min-h-0 print:p-[10mm_12mm] print:m-0 relative"
            >
              {renderPageContent(page, false)}
            </div>
          ))
        ) : (
          /* B4横 (A4×2見開き) モード */
          b4Spreads.map((spread, sIdx) => (
            <div
              key={sIdx}
              style={b4Zoom === "fit" ? { zoom: 0.56 } : undefined}
              className={`b4-sheet bg-white text-slate-900 shadow-lg border border-slate-300 mb-8 print:mb-0 print:shadow-none print:border-none print:w-full print:max-w-none print:min-h-0 print:p-0 print:m-0 relative w-[364mm] min-w-[364mm] min-h-[257mm] px-8 py-6 grid grid-cols-2 gap-8`}
            >
              {/* 中央折り目ガイド（二つ折り破線） */}
              <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex flex-col items-center justify-between pointer-events-none z-10 py-1 text-slate-300 text-[8px] font-mono select-none print:text-slate-400">
                <span className="bg-white/90 px-1 rounded border border-slate-200 print:border-slate-300">▼ 折線</span>
                <div className="flex-1 w-[1px] border-r border-dashed border-slate-300 my-1 print:border-slate-400" />
                <span className="bg-white/90 px-1 rounded border border-slate-200 print:border-slate-300">▲ 折線</span>
              </div>

              {/* 左半分: A4第1ページ (または奇数ページ) */}
              <div className="pr-3 sm:pr-4 h-full">
                {renderPageContent(spread.leftPage, true)}
              </div>

              {/* 右半分: A4第2ページ (または偶数ページ) */}
              <div className="pl-3 sm:pl-4 h-full">
                {spread.rightPage ? (
                  renderPageContent(spread.rightPage, true)
                ) : (
                  /* 第2ページがない場合は学校テスト定番の「計算スペース / メモ欄」を形成 */
                  <div className="flex flex-col h-full justify-between p-3 sm:p-4 border border-dashed border-slate-300 rounded bg-slate-50/40 print:bg-white print:border-slate-300">
                    <div>
                      <div className="border-b border-slate-400 pb-1 flex justify-between items-baseline">
                        <span className="text-[10px] font-bold text-slate-700 print:text-slate-800">
                          【 計算スペース / メモ欄 】
                        </span>
                        <span className="text-[8px] text-slate-400">解答は左面の解答欄に記入</span>
                      </div>
                      <div className="h-48 sm:h-72 my-3 rounded bg-[linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:100%_20px] print:bg-[linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)]" />
                    </div>

                    <div className="no-print text-center pt-2 border-t border-slate-200">
                      {onAddNewPageSection && (
                        <button
                          type="button"
                          onClick={onAddNewPageSection}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          第2ページを作成して大問を追加
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ★ 全画面見開きプレビューモーダル（大画面でB4横全体を見渡して直接編集・印刷） ★ */}
      {isMaximized && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-150">
          {/* モーダルヘッダー */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-600 text-white text-xs font-extrabold px-2 py-0.5 rounded">
                {paperMode === "b4" ? "B4横 (A4×2) 見開き全画面プレビュー" : "A4縦 全画面プレビュー"}
              </span>
              <h3 className="text-sm font-bold text-slate-200">{test.title}</h3>
              <span className="text-xs text-slate-400 font-mono">全 {totalPages} ページ</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                このまま印刷・PDF出力
              </button>

              <button
                type="button"
                onClick={() => setIsMaximized(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                通常画面に戻る
              </button>
            </div>
          </div>

          {/* モーダルプレビュー本体 */}
          <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-start bg-slate-900/60">
            {paperMode === "b4" ? (
              b4Spreads.map((spread, sIdx) => (
                <div
                  key={sIdx}
                  className="b4-sheet bg-white text-slate-900 shadow-2xl border border-slate-300 w-[364mm] min-w-[364mm] min-h-[257mm] px-8 py-6 mb-8 grid grid-cols-2 gap-8 relative rounded-xs"
                >
                  {/* 中央折り目ガイド */}
                  <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex flex-col items-center justify-between pointer-events-none z-10 py-1 text-slate-300 text-[8px] font-mono select-none">
                    <span className="bg-white/95 px-1 rounded border border-slate-200">▼ 折線</span>
                    <div className="flex-1 w-[1px] border-r border-dashed border-slate-300 my-1" />
                    <span className="bg-white/95 px-1 rounded border border-slate-200">▲ 折線</span>
                  </div>

                  {/* 左半分 */}
                  <div className="pr-4 h-full">
                    {renderPageContent(spread.leftPage, true)}
                  </div>

                  {/* 右半分 */}
                  <div className="pl-4 h-full">
                    {spread.rightPage ? (
                      renderPageContent(spread.rightPage, true)
                    ) : (
                      <div className="flex flex-col h-full justify-between p-4 border border-dashed border-slate-300 rounded bg-slate-50/40">
                        <div>
                          <div className="border-b border-slate-400 pb-1 flex justify-between items-baseline">
                            <span className="text-[11px] font-bold text-slate-700">【 計算スペース / メモ欄 】</span>
                            <span className="text-[9px] text-slate-400">解答は左面の解答欄に記入</span>
                          </div>
                          <div className="h-96 my-4 rounded bg-[linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:100%_20px]" />
                        </div>
                        <div className="text-center pt-2">
                          {onAddNewPageSection && (
                            <button
                              type="button"
                              onClick={() => {
                                onAddNewPageSection();
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              第2ページを作成して大問を追加
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              pageNumbers.map((page) => (
                <div
                  key={page}
                  className="a4-sheet bg-white text-slate-900 shadow-2xl border border-slate-300 w-[210mm] min-w-[210mm] min-h-[297mm] px-[12mm] py-[10mm] mb-8 relative rounded-xs"
                >
                  {renderPageContent(page, true)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
