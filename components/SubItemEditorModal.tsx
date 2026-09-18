"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Question } from "@/types/quiz";
import {
  X,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Shuffle,
  ListFilter,
  Save,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  Undo2,
  HelpCircle,
  FileText,
  Eye,
  CheckCircle2,
  BookOpen
} from "lucide-react";
import { MathText } from "@/components/MathText";
import {
  parseSubItems,
  reconstructQuestionWithSelectedSubItems,
  formatSubLabel,
  ParsedSubItem,
  SubItemLabelType,
  CIRCLED_NUMBERS,
  FULL_PAREN_NUMBERS
} from "@/lib/subItemUtils";
import { analyzeAnswerFieldStructure } from "@/lib/answerFieldEngine";

interface SubItemEditorModalProps {
  isOpen: boolean;
  question: Question | null;
  targetPosition?: { secIdx: number; qIdx: number } | null;
  mode?: "selection" | "master";
  onClose: () => void;
  onSave: (updatedQuestion: Question, targetPosition?: { secIdx: number; qIdx: number } | null) => void;
}

export const SubItemEditorModal: React.FC<SubItemEditorModalProps> = ({
  isOpen,
  question,
  targetPosition,
  mode,
  onClose,
  onSave
}) => {
  // 実効モード: 明示指定があればそれ、なければ targetPosition の有無で自動判定（secIdx < 0 または null なら master）
  const isMasterMode = mode ? mode === "master" : (!targetPosition || targetPosition.secIdx < 0);

  // 導入文・指示文
  const [leadInText, setLeadInText] = useState<string>("");
  // 枝問（小問）アイテムのリスト
  const [items, setItems] = useState<ParsedSubItem[]>([]);
  // 選択されているアイテムのインデックス
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  // ラベルタイプ
  const [labelType, setLabelType] = useState<SubItemLabelType>("paren");
  // 元の問題文・解答の保持
  const [baseQuestion, setBaseQuestion] = useState<Question | null>(null);
  // プレビューの表示モード（生徒用問題用紙 / 教師用模範解答）
  const [previewTab, setPreviewTab] = useState<"student" | "teacher">("student");

  // リアルタイム紙面プレビューのデータ計算
  const previewData = useMemo(() => {
    return reconstructQuestionWithSelectedSubItems(
      leadInText,
      items,
      selectedIndices,
      labelType
    );
  }, [leadInText, items, selectedIndices, labelType]);

  // モーダルが開かれたときに問題データを解析してステート初期化
  useEffect(() => {
    if (!isOpen || !question) return;

    setBaseQuestion({ ...question });

    // 元テキスト（間引き前があれば優先、なければ現在のテキスト）
    const origQ = question.originalQuestionText || question.questionText;
    const origA = question.originalAnswer || question.answer;
    const origE = question.originalExplanation || question.explanation || "";

    const parsed = parseSubItems(origQ, origA, origE);

    setLeadInText(parsed.leadInText);
    setLabelType(parsed.labelType);

    if (parsed.items.length > 0) {
      setItems(parsed.items);
      if (!isMasterMode && question.selectedSubItemIndices && question.selectedSubItemIndices.length > 0) {
        // 既存の選択状態を復元（STEP 2/3 出題選択モード時のみ）
        const valid = question.selectedSubItemIndices.filter(idx => idx < parsed.items.length);
        setSelectedIndices(valid.length > 0 ? valid : parsed.items.map((_, i) => i));
      } else {
        // マスターモードまたは未選択時は全問選択
        setSelectedIndices(parsed.items.map((_, i) => i));
      }
    } else {
      // 枝問が自動判定されなかった場合は、問題文全体を1問目の枝問として初期セットし追加できるようにする
      const singleItem: ParsedSubItem = {
        index: 0,
        rawLine: question.questionText,
        originalNumber: 1,
        originalLabel: "(1)",
        labelType: "paren",
        promptText: question.questionText,
        answerText: question.answer,
        explanationText: question.explanation
      };
      setItems([singleItem]);
      setSelectedIndices([0]);
      setLabelType("paren");
    }
  }, [isOpen, question, isMasterMode]);

  if (!isOpen || !question) return null;

  // 出題選択のトグル（削る / 戻す）
  const handleToggleSelect = (itemIndex: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(itemIndex)) {
        // 少なくとも1つは選択を保持
        if (prev.length <= 1) return prev;
        return prev.filter(i => i !== itemIndex);
      } else {
        return [...prev, itemIndex].sort((a, b) => a - b);
      }
    });
  };

  // クイック一括選択
  const handleQuickSelect = (type: "all" | "even" | "odd" | "random5" | "random8") => {
    const all = items.map((_, i) => i);
    if (type === "all") {
      setSelectedIndices(all);
    } else if (type === "odd") {
      // 1-indexed で奇数問 (0, 2, 4...)
      const odd = all.filter(i => (i + 1) % 2 !== 0);
      setSelectedIndices(odd.length > 0 ? odd : all);
    } else if (type === "even") {
      // 1-indexed で偶数問 (1, 3, 5...)
      const even = all.filter(i => (i + 1) % 2 === 0);
      setSelectedIndices(even.length > 0 ? even : all);
    } else if (type === "random5") {
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(5, all.length)).sort((a, b) => a - b);
      setSelectedIndices(selected);
    } else if (type === "random8") {
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(8, all.length)).sort((a, b) => a - b);
      setSelectedIndices(selected);
    }
  };

  // 枝問アイテムの問題文テキスト編集
  const handleUpdateItemPrompt = (idx: number, newPrompt: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      return {
        ...it,
        promptText: newPrompt
      };
    }));
  };

  // 枝問アイテムの解答テキスト編集
  const handleUpdateItemAnswer = (idx: number, newAns: string) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, answerText: newAns } : it)));
  };

  // 枝問の削除（枝問ではない行を除外・削除）
  const handleDeleteItem = (idxToDelete: number) => {
    if (items.length <= 1) return;

    setItems(prev => {
      const filtered = prev.filter((_, i) => i !== idxToDelete);
      // インデックスを振り直し
      return filtered.map((it, newIdx) => ({
        ...it,
        index: newIdx,
        originalNumber: newIdx + 1,
        originalLabel: formatSubLabel(newIdx + 1, labelType)
      }));
    });

    // 選択インデックスも追従補正
    setSelectedIndices(prev => {
      const next = prev
        .filter(i => i !== idxToDelete)
        .map(i => (i > idxToDelete ? i - 1 : i));
      return next.length > 0 ? next : [0];
    });
  };

  // 新しい枝問の追加
  const handleAddItem = () => {
    const nextNum = items.length + 1;
    const newItem: ParsedSubItem = {
      index: items.length,
      rawLine: `${formatSubLabel(nextNum, labelType)} `,
      originalNumber: nextNum,
      originalLabel: formatSubLabel(nextNum, labelType),
      labelType: labelType,
      promptText: "",
      answerText: ""
    };

    setItems(prev => [...prev, newItem]);
    setSelectedIndices(prev => [...prev, items.length]);
  };

  // 枝問の順序入れ替え（上へ）
  const handleMoveUp = (idx: number) => {
    if (idx <= 0) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next.map((it, i) => ({
        ...it,
        index: i,
        originalNumber: i + 1,
        originalLabel: formatSubLabel(i + 1, labelType)
      }));
    });
  };

  // 枝問の順序入れ替え（下へ）
  const handleMoveDown = (idx: number) => {
    if (idx >= items.length - 1) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next.map((it, i) => ({
        ...it,
        index: i,
        originalNumber: i + 1,
        originalLabel: formatSubLabel(i + 1, labelType)
      }));
    });
  };

  // ラベル形式（(1) / （１） / ①）の変更
  const handleChangeLabelType = (newType: SubItemLabelType) => {
    setLabelType(newType);
    setItems(prev => prev.map((it, i) => ({
      ...it,
      labelType: newType,
      originalLabel: formatSubLabel(i + 1, newType),
      rawLine: `${formatSubLabel(i + 1, newType)} ${it.promptText}`
    })));
  };

  // 文章から小問を一括自動再分割・検出
  const handleAutoDetectSubItems = () => {
    const allLines: string[] = [];
    if (leadInText) allLines.push(leadInText);
    items.forEach(it => {
      // 枝問の元の行またはpromptText
      allLines.push(it.rawLine || it.promptText);
    });
    const combined = allLines.join("\n");
    const parsed = parseSubItems(combined, baseQuestion?.answer || "", baseQuestion?.explanation || "");

    if (parsed.items.length >= 2) {
      setLeadInText(parsed.leadInText);
      setItems(parsed.items);
      setSelectedIndices(parsed.items.map((_, i) => i));
      setLabelType(parsed.labelType);
    }
  };

  // 枝問分割を完全に解除して通常の1問に戻す
  const handleResetSubItemSplit = () => {
    if (!baseQuestion) return;
    const origQ = baseQuestion.originalQuestionText || baseQuestion.questionText;
    const origA = baseQuestion.originalAnswer || baseQuestion.answer;
    const origE = baseQuestion.originalExplanation || baseQuestion.explanation || "";

    const revertedQuestion: Question = {
      ...baseQuestion,
      questionText: origQ,
      answer: origA,
      explanation: origE,
      isSubItemDisabled: true,
      selectedSubItemIndices: undefined,
      answerLabels: undefined
    };

    onSave(revertedQuestion, targetPosition);
    onClose();
  };

  // 保存して反映
  const handleSave = () => {
    if (!baseQuestion) return;

    // 現在の選択された小問で問題文・解答・解答欄ラベルを再構成
    const reconstructed = reconstructQuestionWithSelectedSubItems(
      leadInText,
      items,
      selectedIndices,
      labelType
    );

    // 全小問を含む完全なベース問題文・解答（次回復元用）
    const allIndices = items.map((_, i) => i);
    const masterRecon = reconstructQuestionWithSelectedSubItems(
      leadInText,
      items,
      allIndices,
      labelType
    );

    const updatedQuestion: Question = {
      ...baseQuestion,
      questionText: reconstructed.newQuestionText,
      answer: reconstructed.newAnswer || baseQuestion.answer,
      answerLabels: reconstructed.newAnswerLabels.length > 0 ? reconstructed.newAnswerLabels : baseQuestion.answerLabels,
      originalQuestionText: masterRecon.newQuestionText,
      originalAnswer: masterRecon.newAnswer || baseQuestion.originalAnswer || baseQuestion.answer,
      selectedSubItemIndices: (!isMasterMode && selectedIndices.length < items.length) ? selectedIndices : undefined
    };

    onSave(updatedQuestion, targetPosition);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
              <ListFilter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2 text-white">
                <span>
                  {isMasterMode
                    ? "大問内の枝問（マスターデータ）編集"
                    : "大問内の枝問（小問）編集 ＆ 選択リナンバリング"}
                </span>
                {isMasterMode && (
                  <span className="bg-sky-500/30 text-sky-200 border border-sky-400/40 text-[10px] px-1.5 py-0.2 rounded font-medium">
                    問題バンク（マスター）
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isMasterMode
                  ? "問題バンクの枝問構造（AI誤判定行の削除・枝問の追加・文面や解答の修正）を整備します"
                  : "自動判定結果の修正（枝問でない行の削除・枝問の追加）、出題する小問の絞り込み、番号の動的採番を行います"}
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

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 基本ステータス & 単元バッジ */}
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">対象問題:</span>
              <span className="font-bold text-slate-800 bg-white border border-slate-300 px-2 py-0.5 rounded text-[11px]">
                {baseQuestion?.genre} ❯ {baseQuestion?.topic}
              </span>
              {baseQuestion?.subTopic && (
                <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                  {baseQuestion.subTopic}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px]">
                {isMasterMode
                  ? `全 ${items.length} 枝問 登録中`
                  : `全 ${items.length} 枝問中 ${selectedIndices.length} 問 出題中`}
              </span>
            </div>
          </div>

          {/* 単一問題（未分割）の場合のガイドバナー */}
          {items.length <= 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-[11px]">枝問が未設定の問題です</div>
                <div className="text-[10px] text-amber-800 leading-relaxed">
                  大問指示文（導入文）を入力し、「＋ 枝問を追加」ボタンから小問 (1), (2)... を追加することで、枝問形式の問題に拡張・分割できます。
                </div>
              </div>
            </div>
          )}

          {/* 1. 導入文・指示文の編集エリア */}
          <div className="space-y-1.5 bg-sky-50/50 p-3 rounded-xl border border-sky-200/80">
            <label className="block font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>導入文・大問指示文（小問より前の共通文）</span>
              </span>
              <span className="text-[10px] font-normal text-slate-500">
                出題数に合わせて「(1)〜(N)」や「（１）〜（Ｎ）」の範囲表記が自動補正されます
              </span>
            </label>
            <textarea
              rows={2}
              value={leadInText}
              onChange={e => setLeadInText(e.target.value)}
              placeholder="例: 次の1次関数の変化の割合をそれぞれ答えなさい。(1)〜(5)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-serif leading-relaxed text-slate-800 text-xs"
            />
          </div>

          {/* 2. 番号形式切替 & クイック選択ツールバー */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200/80">
            {/* 番号形式 */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 text-[11px] shrink-0">番号形式:</span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleChangeLabelType("paren")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition ${
                    labelType === "paren"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="半角括弧: (1), (2), (3)..."
                >
                  (1) 半角
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeLabelType("fullParen")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition ${
                    labelType === "fullParen"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="全角括弧: （１）, （２）, （３）..."
                >
                  （１） 全角
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeLabelType("circled")}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition ${
                    labelType === "circled"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="丸数字: ①, ②, ③..."
                >
                  ① 丸数字
                </button>
              </div>
            </div>

            {/* クイック選択（出題選択モード時のみ表示、マスター編集時は非表示） */}
            {!isMasterMode ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-500 font-semibold mr-0.5">一括選択:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSelect("all")}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                >
                  全問
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect("odd")}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                >
                  奇数問
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect("even")}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                >
                  偶数問
                </button>
                {items.length >= 6 && (
                  <button
                    type="button"
                    onClick={() => handleQuickSelect("random5")}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded text-[10px] font-bold text-indigo-700 flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>5問抽出</span>
                  </button>
                )}
                {items.length >= 9 && (
                  <button
                    type="button"
                    onClick={() => handleQuickSelect("random8")}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded text-[10px] font-bold text-indigo-700 flex items-center gap-0.5 cursor-pointer shadow-2xs"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>8問抽出</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">
                マスター編集モード（全枝問が問題バンクに登録されます）
              </div>
            )}
          </div>

          {/* 3. 枝問リスト一覧（編集 ＆ 選択 ＆ 削除 ＆ 追加） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <span>📋 枝問アイテム一覧（自動判定結果の修正・追加・削除）</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoDetectSubItems}
                  className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-md text-[10.5px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition"
                  title="テキスト内の (1) (2) や ① ② を再解析して小問リストに一括自動分割"
                >
                  <Sparkles className="w-3 h-3 text-sky-600" />
                  <span>文章から小問を自動分割</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新しい枝問を追加</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const isSelected = selectedIndices.includes(item.index);
                const currentOrder = selectedIndices.indexOf(item.index) + 1;

                return (
                  <div
                    key={item.index}
                    className={`p-3 rounded-xl border transition flex flex-col gap-2 ${
                      isMasterMode || isSelected
                        ? "bg-white border-indigo-300 shadow-xs ring-1 ring-indigo-200/50"
                        : "bg-slate-50/80 border-slate-200 opacity-60 hover:opacity-90"
                    }`}
                  >
                    {/* 上段: チェックボックス（出題選択時のみ） + ラベル + 採番バッジ + 操作ボタン */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!isMasterMode && (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.index)}
                            className="cursor-pointer text-slate-600 hover:text-indigo-600 transition"
                            title={isSelected ? "この枝問を出題から削る（非表示）" : "この枝問を出題に含める"}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        )}

                        <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
                          <span className="text-slate-500">枝問 #{idx + 1}</span>
                          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-black text-[11px]">
                            {formatSubLabel(idx + 1, labelType)}
                          </span>
                        </span>

                        {/* 出題採番バッジ（出題選択モード時のみ） */}
                        {!isMasterMode && (
                          isSelected ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10.5px] font-black px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                              <span>出題 ➔</span>
                              <span>{formatSubLabel(currentOrder, labelType)}</span>
                            </span>
                          ) : (
                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              除外中（削る）
                            </span>
                          )
                        )}
                      </div>

                      {/* 移動 & 削除操作 */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition cursor-pointer"
                          title="上へ移動"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition cursor-pointer"
                          title="下へ移動"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer ml-1"
                          title="この行は枝問ではないため削除（枝問リストから除外）"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 中段: 枝問テキスト入力 & 解答入力 */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-8">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                          問題文（TeX数式 $...$ も可）
                        </label>
                        <input
                          type="text"
                          value={item.promptText}
                          onChange={e => handleUpdateItemPrompt(idx, e.target.value)}
                          placeholder="例: $y=-6x+5$ の傾きと切片を求めなさい"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-serif text-slate-800 text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                          模範解答
                        </label>
                        <input
                          type="text"
                          value={item.answerText || ""}
                          onChange={e => handleUpdateItemAnswer(idx, e.target.value)}
                          placeholder="例: 傾き: -6, 切片: 5"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-serif text-slate-800 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. 実際の紙面プレビュー（リアルタイム連動） */}
          <div className="space-y-2.5 bg-slate-100/80 p-3.5 rounded-2xl border border-slate-300/80 shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>👀 実際の紙面プレビュー（リアルタイム連動）</span>
                </span>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  {isMasterMode
                    ? `全 ${previewData.newAnswerLabels.length} 枝問`
                    : `出題 ${previewData.newAnswerLabels.length} 問`}
                </span>
              </div>

              {/* 生徒用 / 模範解答 切り替えタブ */}
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPreviewTab("student")}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                    previewTab === "student"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>📄 問題用紙（生徒用）</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("teacher")}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                    previewTab === "teacher"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>💡 模範解答（教師用）</span>
                </button>
              </div>
            </div>

            {/* プレビュー表示本体 */}
            {previewTab === "student" ? (
              (() => {
                const previewStruct = analyzeAnswerFieldStructure(
                  previewData.newQuestionText,
                  previewData.newAnswer
                );

                if (previewStruct.type === "block-blanks" && previewStruct.blockItems && previewStruct.blockItems.length > 0) {
                  return (
                    <div className="bg-white border-2 border-slate-300 rounded-xl p-4 font-serif text-slate-900 shadow-xs space-y-3.5">
                      <div className="text-[10px] font-sans font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <span>【問題用紙プレビュー（親小問・子空所連動型）】</span>
                      </div>
                      <div className="space-y-3">
                        {previewStruct.blockItems.map((b, bIdx) => (
                          <div key={bIdx} className="space-y-1">
                            <div className="text-[12px] leading-relaxed text-slate-950">
                              <MathText text={b.rawText} />
                            </div>
                            {b.blankLabels.length > 0 && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-3 pt-0.5">
                                {b.blankLabels.map((lbl, lIdx) => (
                                  <div key={lIdx} className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] font-bold text-slate-800 min-w-[20px]">
                                      {lbl}
                                    </span>
                                    <div className="border-b-2 border-slate-700 w-20 h-4 bg-white rounded-xs shadow-2xs" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-white border-2 border-slate-300 rounded-xl p-4 font-serif text-slate-900 shadow-xs space-y-3.5">
                    {/* 問題文プレビュー */}
                    <div>
                      <div className="text-[10px] font-sans font-bold text-slate-400 mb-1 flex items-center gap-1">
                        <span>【問題文（実際の見え方）】</span>
                      </div>
                      <div className="leading-relaxed text-[12px] whitespace-pre-line text-slate-950 font-serif">
                        <MathText text={previewData.newQuestionText || "（小問が選択されていません）"} />
                      </div>
                    </div>

                    {/* 解答欄プレビュー */}
                    <div className="pt-2.5 border-t border-slate-200">
                      <div className="text-[10px] font-sans font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                        <span>【解答欄（生徒が記入する枠）】</span>
                      </div>
                      {previewData.newAnswerLabels.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-sans font-bold text-slate-500 shrink-0">答</span>
                          {previewData.newAnswerLabels.map((lbl, lIdx) => (
                            <div key={lIdx} className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold text-slate-800 min-w-[22px]">
                                {lbl}
                              </span>
                              <div className="border-b-2 border-slate-700 w-24 h-4 bg-white rounded-xs shadow-2xs" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic">
                          出題する小問がありません
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="bg-rose-50/90 border-2 border-rose-200 rounded-xl p-4 font-serif shadow-xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs font-sans">
                  <span className="bg-rose-200 px-1.5 py-0.5 rounded text-[10px]">模範解答プレビュー</span>
                  <span className="text-[11px] text-rose-700">（採点基準・指導用）</span>
                </div>
                <div className="bg-white/90 p-3 rounded-lg border border-rose-200 text-rose-950 text-[12px] leading-relaxed">
                  <MathText text={previewData.newAnswer || "（解答がありません）"} />
                </div>
                {previewData.newExplanation && (
                  <div className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-lg border border-rose-100">
                    <span className="font-bold font-sans text-[10px] text-slate-500 block mb-0.5">【解説】</span>
                    <MathText text={previewData.newExplanation} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetSubItemSplit}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="枝問分割を解除し、元の1問完結の問題文・模範解答に戻します"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-700" />
              <span>↩ 枝問分割を解除（1問に戻す）</span>
            </button>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {isMasterMode
                  ? "保存すると、問題バンクの枝問マスターデータ（問題文・模範解答・解答欄ラベル）が美しく更新されます"
                  : "保存すると、出題する小問番号が1から順に動的再採番され、問題文と解答欄が自動更新されます"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition shadow-2xs"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存して反映</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
