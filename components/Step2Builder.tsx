"use client";

import React from "react";
import { QuizTest, Question } from "@/types/quiz";
import { MathText } from "./MathText";
import {
  RefreshCw,
  Edit3,
  Trash2,
  Zap,
  Calculator,
  Plus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Undo2,
  FileText,
  ListFilter,
  Headphones,
  Image as ImageIcon,
  Link2,
  Unlink,
  ArrowUp,
  ArrowDown,
  Scissors
} from "lucide-react";
import { resolveSectionPages, getMaxPageNumber } from "@/lib/pageUtils";
import { parseSubItems } from "@/lib/subItemUtils";

interface Step2BuilderProps {
  test: QuizTest;
  currentTotal: number;
  onAutoFillSlots: () => void;
  onRecalculateScores: () => void;
  onSwapQuestion: (secIdx: number, qIdx: number) => void;
  onEditQuestion: (secIdx: number, qIdx: number, q: Question) => void;
  onOpenSubItemEditor?: (secIdx: number, qIdx: number, q: Question) => void;
  onDeleteQuestion: (secIdx: number, qIdx: number) => void;
  onAddEmptySlot: (secIdx: number) => void;
  onUpdateScore: (secIdx: number, qIdx: number, points: number) => void;
  onUpdateSectionTitle: (secIdx: number, newTitle: string) => void;
  onAutoGenerateSectionTitle?: (secIdx: number) => void;
  onAddSection: () => void;
  onDeleteSection: (secIdx: number) => void;
  onMergeWithNextSection?: (secIdx: number) => void;
  onUnmergeSection?: (secIdx: number) => void;
  onMergeQuestions?: (secIdx: number, qIdx: number) => void;
  onUnmergeQuestion?: (secIdx: number, qIdx: number) => void;
  onMergeAllQuestionsInSection?: (secIdx: number) => void;
  onSplitSectionAt?: (secIdx: number, qIdx: number) => void;
  onMoveQuestion?: (secIdx: number, qIdx: number, direction: "up" | "down") => void;
  onUpdateSectionPage?: (secIdx: number, page: number) => void;
  onAddNewPageSection?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const Step2Builder: React.FC<Step2BuilderProps> = ({
  test,
  currentTotal,
  onAutoFillSlots,
  onRecalculateScores,
  onSwapQuestion,
  onEditQuestion,
  onOpenSubItemEditor,
  onDeleteQuestion,
  onAddEmptySlot,
  onUpdateScore,
  onUpdateSectionTitle,
  onAutoGenerateSectionTitle,
  onAddSection,
  onDeleteSection,
  onMergeWithNextSection,
  onUnmergeSection,
  onMergeQuestions,
  onUnmergeQuestion,
  onMergeAllQuestionsInSection,
  onSplitSectionAt,
  onMoveQuestion,
  onUpdateSectionPage,
  onAddNewPageSection,
  onUndo,
  canUndo = false
}) => {
  const isJust100 = currentTotal === 100;
  const isUnder = currentTotal < 100;

  // 各大問の所属ページ（手動指定または自動オーバーフロー計算）を解決
  const resolvedSections = resolveSectionPages(test.sections);
  const maxPage = getMaxPageNumber(test.sections);

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* カラムヘッダー（STEP 2） */}
      <div className="px-3 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-indigo-600 text-white shrink-0 shadow-2xs">
            STEP 2
          </span>
          <h2 className="text-xs font-bold text-indigo-950 truncate whitespace-nowrap" title="テスト編成（スロット管理）">
            テスト編成
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
            onClick={onAutoFillSlots}
            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
            title="問題プールから各スロットに自動で問題を充填します"
          >
            <Zap className="w-3 h-3" />
            <span>自動充填</span>
          </button>
          <button
            onClick={onRecalculateScores}
            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
            title="現在の問題数で100点になるよう均等配分します"
          >
            <Calculator className="w-3 h-3" />
            <span>配点均等</span>
          </button>
        </div>
      </div>

      {/* 配点サマリーバー */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1">
            合計点数 (目標: 100点)
            {maxPage > 1 && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-bold">
                全 {maxPage} ページ
              </span>
            )}
          </span>
          <span
            className={`font-extrabold flex items-center gap-1 ${
              isJust100 ? "text-emerald-600" : isUnder ? "text-amber-600" : "text-rose-600"
            }`}
          >
            {isJust100 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ちょうど 100点！
              </>
            ) : isUnder ? (
              <>
                <AlertCircle className="w-3 h-3 text-amber-600" />
                {currentTotal}点 (あと{100 - currentTotal}点)
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-600" />
                {currentTotal}点 ({currentTotal - 100}点超過)
              </>
            )}
          </span>
        </div>

        {/* プログレスバー */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isJust100 ? "bg-emerald-500" : isUnder ? "bg-amber-500" : "bg-rose-500"
            }`}
            style={{ width: `${Math.min(currentTotal, 100)}%` }}
          />
        </div>
      </div>

      {/* 大問セクション・スロット一覧 */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {resolvedSections.map((item, index) => {
          const { section: sec, secIdx, page } = item;
          const prevPage = index > 0 ? resolvedSections[index - 1].page : null;
          const showPageBanner = prevPage === null || prevPage !== page;

          return (
            <React.Fragment key={sec.id || secIdx}>
              {/* ページ区切りバナー */}
              {showPageBanner && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px bg-slate-300 flex-1" />
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <FileText className="w-3 h-3 text-indigo-600" />
                    第 {page} ページ
                  </span>
                  <div className="h-px bg-slate-300 flex-1" />
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs space-y-2">
                {/* セクション見出し（インライン編集 ＆ 論点自動入力 ＆ ページ切替 ＆ 大問削除） */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    <input
                      type="text"
                      value={sec.title}
                      onChange={e => onUpdateSectionTitle(secIdx, e.target.value)}
                      className="font-bold text-xs text-slate-800 font-serif bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded px-1 py-0.5 w-full focus:outline-none transition"
                      placeholder="大問タイトルを入力..."
                      title="クリックして大問タイトルを変更"
                    />
                    {onAutoGenerateSectionTitle && (
                      <button
                        type="button"
                        onClick={() => onAutoGenerateSectionTitle(secIdx)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition shrink-0"
                        title="設問の論点（単元・サブ論点）から題名を自動入力"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* マージ解除ボタン（マージされている場合） */}
                    {onUnmergeSection && sec.mergedSectionTitles && sec.mergedSectionTitles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onUnmergeSection(secIdx)}
                        className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        title="マージを解除して元の大問に分割・復元"
                      >
                        <Unlink className="w-2.5 h-2.5 text-amber-700" />
                        <span>マージ解除</span>
                      </button>
                    )}

                    {/* 大問内の全小問を一括マージ */}
                    {onMergeAllQuestionsInSection && sec.questions.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => onMergeAllQuestionsInSection(secIdx)}
                        className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        title="この大問内のすべての小問を1つにマージして連番化"
                      >
                        <Link2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>小問一括マージ</span>
                      </button>
                    )}

                    {/* 下の大問とマージボタン（次の大問がある場合） */}
                    {onMergeWithNextSection && secIdx < test.sections.length - 1 && (
                      <button
                        type="button"
                        onClick={() => onMergeWithNextSection(secIdx)}
                        className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        title="下の大問とマージして1つの大問に統合（元データは壊れません）"
                      >
                        <Link2 className="w-2.5 h-2.5 text-indigo-600" />
                        <span>大問マージ</span>
                      </button>
                    )}

                    {/* ページ移動切替ボタン */}
                    {onUpdateSectionPage && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextP = page === 1 ? 2 : 1;
                          onUpdateSectionPage(secIdx, nextP);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                        title={`この大問を第${page === 1 ? 2 : 1}ページへ移動`}
                      >
                        <FileText className="w-2.5 h-2.5 text-indigo-500" />
                        <span>{page}P</span>
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">
                      {sec.questions.length}問 / 計{" "}
                      {sec.questions.reduce((acc, q) => acc + (q.defaultPoints || 0), 0)}点
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSection(secIdx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                      title={test.sections.length > 1 ? "この大問ごと削除" : "大問内の問題を全削除"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* スロット群 */}
                <div className="space-y-1.5">
                  {sec.questions.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded">
                      問題がありません。左のプールから追加してください。
                    </div>
                  ) : (
                    sec.questions.map((q, qIdx) => (
                      <div
                        key={q.id || `${secIdx}-${qIdx}`}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-md hover:border-indigo-300 transition text-xs space-y-1 group"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[10px]">
                              {qIdx + 1}
                            </span>
                            <span className="font-semibold text-slate-700">{q.topic}</span>
                            {q.subTopic && (
                              <span className="text-slate-500 text-[9px] bg-white border border-slate-200 px-1 py-0.2 rounded truncate max-w-[100px]">
                                {q.subTopic}
                              </span>
                            )}
                            {q.selectedSubItemIndices ? (
                              <button
                                type="button"
                                onClick={() => onOpenSubItemEditor ? onOpenSubItemEditor(secIdx, qIdx, q) : onEditQuestion(secIdx, qIdx, q)}
                                className="text-indigo-700 hover:text-indigo-900 text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.2 rounded font-bold shrink-0 cursor-pointer transition flex items-center gap-0.5"
                                title="クリックして枝問（小問）を編集・再採番"
                              >
                                <ListFilter className="w-2.5 h-2.5" />
                                <span>{q.selectedSubItemIndices.length}問抽出</span>
                              </button>
                            ) : parseSubItems(q.originalQuestionText || q.questionText).hasSubItems ? (
                              <button
                                type="button"
                                onClick={() => onOpenSubItemEditor ? onOpenSubItemEditor(secIdx, qIdx, q) : onEditQuestion(secIdx, qIdx, q)}
                                className="text-indigo-700 hover:text-indigo-900 text-[9px] bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.2 rounded font-bold shrink-0 cursor-pointer transition flex items-center gap-0.5"
                                title="クリックして枝問（小問）を削る・再採番"
                              >
                                <ListFilter className="w-2.5 h-2.5" />
                                <span>枝問 {parseSubItems(q.originalQuestionText || q.questionText).items.length}問</span>
                              </button>
                            ) : null}
                            {q.mergedQuestions && q.mergedQuestions.length > 0 && (
                              <span className="text-[8.5px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1 py-0.2 rounded font-sans font-bold flex items-center gap-0.5 shrink-0" title="マージされた問題（解除可能）">
                                🔗 {q.mergedQuestions.length}問統合
                              </span>
                            )}
                            {q.imageUrl ? (
                              <span className="text-[8.5px] bg-sky-50 text-sky-700 border border-sky-200 px-1 py-0.2 rounded font-sans flex items-center gap-0.5 shrink-0" title="画像付き問題">
                                <ImageIcon className="w-2.5 h-2.5 text-sky-600" />
                                画像
                              </span>
                            ) : q.hasImagePlaceholder ? (
                              <span className="text-[8.5px] bg-amber-50 text-amber-800 border border-amber-300 px-1 py-0.2 rounded font-sans flex items-center gap-0.5 shrink-0" title="絵を見て答える問題（画像欄）">
                                <ImageIcon className="w-2.5 h-2.5 text-amber-600" />
                                画像欄
                              </span>
                            ) : null}
                            {q.audioUrl && (
                              <span className="text-[8.5px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded font-sans flex items-center gap-0.5 shrink-0" title="リスニング問題">
                                <Headphones className="w-2.5 h-2.5 text-purple-600" />
                                リスニング
                              </span>
                            )}
                          </div>

                          {/* 配点変更 & 操作ボタン */}
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={q.defaultPoints || 10}
                                onChange={e =>
                                  onUpdateScore(secIdx, qIdx, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-9 text-center border border-slate-200 rounded bg-white text-[10px] py-0.5 font-bold text-slate-700"
                              />
                              <span className="text-[10px] text-slate-400">点</span>
                            </div>

                            {/* 枝問（小問）編集・追加・削除・リナンバリングボタン */}
                            <button
                              type="button"
                              onClick={() => onOpenSubItemEditor ? onOpenSubItemEditor(secIdx, qIdx, q) : onEditQuestion(secIdx, qIdx, q)}
                              className={`p-1 rounded transition cursor-pointer ${
                                q.selectedSubItemIndices || parseSubItems(q.originalQuestionText || q.questionText).hasSubItems
                                  ? "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                  : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              }`}
                              title={
                                parseSubItems(q.originalQuestionText || q.questionText).hasSubItems
                                  ? "大問内の枝問（小問）を編集・追加・削除・選択リナンバリング"
                                  : "この問題の枝問メニュー（分割・追加・編集）"
                              }
                            >
                              <ListFilter className="w-3 h-3" />
                            </button>

                            {/* 順序移動ボタン (上へ) */}
                            {onMoveQuestion && (
                              <button
                                type="button"
                                onClick={() => onMoveQuestion(secIdx, qIdx, "up")}
                                disabled={secIdx === 0 && qIdx === 0}
                                className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded hover:bg-indigo-50 transition cursor-pointer"
                                title="問題を上へ移動（先頭の場合は前の大問の末尾へ移動）"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                            )}

                            {/* 順序移動ボタン (下へ) */}
                            {onMoveQuestion && (
                              <button
                                type="button"
                                onClick={() => onMoveQuestion(secIdx, qIdx, "down")}
                                disabled={secIdx === test.sections.length - 1 && qIdx === sec.questions.length - 1}
                                className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded hover:bg-indigo-50 transition cursor-pointer"
                                title="問題を下へ移動（末尾の場合は次の大問の先頭へ移動）"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}

                            {/* 小問マージ解除ボタン */}
                            {onUnmergeQuestion && q.mergedQuestions && q.mergedQuestions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onUnmergeQuestion(secIdx, qIdx)}
                                className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-50 transition cursor-pointer"
                                title="小問マージを解除して元の問題に復元"
                              >
                                <Unlink className="w-3 h-3 text-amber-600" />
                              </button>
                            )}

                            {/* 下の問題とマージボタン */}
                            {onMergeQuestions && qIdx < sec.questions.length - 1 && (
                              <button
                                type="button"
                                onClick={() => onMergeQuestions(secIdx, qIdx)}
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 transition cursor-pointer"
                                title="下の問題とマージして連番化"
                              >
                                <Link2 className="w-3 h-3" />
                              </button>
                            )}

                            {/* ここで大問を分割 */}
                            {onSplitSectionAt && qIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => onSplitSectionAt(secIdx, qIdx)}
                                className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition cursor-pointer"
                                title="この問題の前で大問を新規分割"
                              >
                                <Scissors className="w-3 h-3 text-amber-600" />
                              </button>
                            )}

                            {/* 差し替えボタン */}
                            <button
                              type="button"
                              onClick={() => onSwapQuestion(secIdx, qIdx)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                              title="このスロットの問題を別候補に差し替え"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>

                            {/* 編集ボタン */}
                            <button
                              type="button"
                              onClick={() => onEditQuestion(secIdx, qIdx, q)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
                              title="この問題を直接編集"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>

                            {/* 削除ボタン */}
                            <button
                              type="button"
                              onClick={() => onDeleteQuestion(secIdx, qIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                              title="このスロットを削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* 問題文プレビュー */}
                        <div className="text-[11px] text-slate-800 line-clamp-2 font-serif pl-5">
                          <MathText text={q.questionText} />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* スロット追加ボタン */}
                <button
                  onClick={() => onAddEmptySlot(secIdx)}
                  className="w-full py-1.5 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded text-[11px] font-medium text-slate-500 hover:text-indigo-700 flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  この大問に空スロットを追加
                </button>
              </div>
            </React.Fragment>
          );
        })}

        {/* ボタン群（大問追加 ＆ ページ追加） */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onAddSection}
            className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新しい大問を追加（大問{test.sections.length + 1}）
          </button>
          {onAddNewPageSection && (
            <button
              type="button"
              onClick={onAddNewPageSection}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-dashed border-emerald-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
              title="第2ページ用の新しい大問を追加"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              次ページ追加
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
