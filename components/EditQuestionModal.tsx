"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Question } from "@/types/quiz";
import { TagInput } from "./TagInput";
import {
  X,
  Save,
  BookOpen,
  GraduationCap,
  CheckSquare,
  Square,
  Shuffle,
  ListFilter,
  Sparkles,
  Image as ImageIcon,
  Headphones,
  Upload,
  Trash2,
  Volume2,
  Loader2,
  AlertCircle,
  Undo2,
  RotateCcw
} from "lucide-react";
import { parseSubItems, reconstructQuestionWithSelectedSubItems, formatSubLabel, ParsedSubItem, SubItemLabelType } from "@/lib/subItemUtils";

interface EditQuestionModalProps {
  isOpen: boolean;
  question: Question | null;
  availableTags?: string[];
  onClose: () => void;
  onSave: (updated: Question) => void;
  onOpenSubItemEditor?: (q: Question) => void;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  isOpen,
  question,
  availableTags = [],
  onClose,
  onSave,
  onOpenSubItemEditor
}) => {
  const [formData, setFormData] = useState<Question | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [answerLabelsStr, setAnswerLabelsStr] = useState<string>("");

  // メディアアップロード用ステート
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 枝問自動分割を無効化（通常の1問に戻す）ステート
  const [isSubItemDisabled, setIsSubItemDisabled] = useState<boolean>(false);

  // 小問選択用の元データ
  const [baseQuestionText, setBaseQuestionText] = useState<string>("");
  const [baseAnswer, setBaseAnswer] = useState<string>("");
  const [baseExplanation, setBaseExplanation] = useState<string>("");
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // 元テキストから小問を自動解析（isSubItemDisabled の場合は解析をバイパス）
  const parsedSubItemsResult = useMemo(() => {
    if (!baseQuestionText || isSubItemDisabled) {
      return { hasSubItems: false, leadInText: baseQuestionText || "", items: [], labelType: "paren" as SubItemLabelType };
    }
    return parseSubItems(baseQuestionText, baseAnswer, baseExplanation, isSubItemDisabled);
  }, [baseQuestionText, baseAnswer, baseExplanation, isSubItemDisabled]);

  // 分割可能かどうか（isSubItemDisabled=true の時でも元テキストに枝問パターンがあるか判定）
  const canSplitSubItems = useMemo(() => {
    if (!baseQuestionText) return false;
    return parseSubItems(baseQuestionText, baseAnswer, baseExplanation, false).hasSubItems;
  }, [baseQuestionText, baseAnswer, baseExplanation]);

  useEffect(() => {
    if (question) {
      setFormData({ ...question });
      setTags(question.tags || []);
      setAnswerLabelsStr(question.answerLabels ? question.answerLabels.join(", ") : "");

      // 元の完全な問題文・解答があればそれをベースとし、なければ現在のものをベースとする
      const origQ = question.originalQuestionText || question.questionText;
      const origA = question.originalAnswer || question.answer;
      const origE = question.originalExplanation || question.explanation || "";
      setBaseQuestionText(origQ);
      setBaseAnswer(origA);
      setBaseExplanation(origE);

      setIsSubItemDisabled(!!question.isSubItemDisabled);

      // 小問解析を行って初期選択インデックスを設定
      if (!question.isSubItemDisabled) {
        const parsed = parseSubItems(origQ, origA, origE, false);
        if (parsed.hasSubItems) {
          if (question.selectedSubItemIndices && question.selectedSubItemIndices.length > 0) {
            setSelectedIndices(question.selectedSubItemIndices);
          } else {
            // デフォルトは全選択
            setSelectedIndices(parsed.items.map(it => it.index));
          }
        } else {
          setSelectedIndices([]);
        }
      } else {
        setSelectedIndices([]);
      }
    }
  }, [question]);

  // 枝問分割を解除（通常の1問に戻す）
  const handleResetSubItemSplit = () => {
    setIsSubItemDisabled(true);
    setSelectedIndices([]);
    setFormData(prev => prev ? {
      ...prev,
      questionText: baseQuestionText,
      answer: baseAnswer,
      isSubItemDisabled: true,
      selectedSubItemIndices: undefined
    } : null);
    setAnswerLabelsStr("");
  };

  // 枝問自動分割を再度有効化
  const handleEnableSubItemSplit = () => {
    setIsSubItemDisabled(false);
    const parsed = parseSubItems(baseQuestionText, baseAnswer, baseExplanation, false);
    if (parsed.hasSubItems) {
      setSelectedIndices(parsed.items.map(it => it.index));
    }
  };

  // 小問の選択状態が変更されたら、問題文・解答・解答欄ラベルを動的リナンバリングしてformDataに反映
  const handleToggleSubItem = (itemIndex: number) => {
    if (!parsedSubItemsResult.hasSubItems || !formData) return;

    const nextSelected = selectedIndices.includes(itemIndex)
      ? selectedIndices.filter(i => i !== itemIndex)
      : [...selectedIndices, itemIndex].sort((a, b) => a - b);

    // 少なくとも1つは選択を保持
    if (nextSelected.length === 0) return;

    setSelectedIndices(nextSelected);

    // 動的リナンバリング
    const reconstructed = reconstructQuestionWithSelectedSubItems(
      parsedSubItemsResult.leadInText,
      parsedSubItemsResult.items,
      nextSelected,
      parsedSubItemsResult.labelType
    );

    setFormData(prev => prev ? {
      ...prev,
      questionText: reconstructed.newQuestionText,
      answer: reconstructed.newAnswer || prev.answer
    } : null);

    setAnswerLabelsStr(reconstructed.newAnswerLabels.join(", "));
  };

  // クイック一括選択
  const handleQuickSelect = (type: "all" | "even" | "odd" | "firstHalf" | "secondHalf" | "random5" | "random8") => {
    if (!parsedSubItemsResult.hasSubItems || !formData) return;
    const all = parsedSubItemsResult.items.map(it => it.index);
    let next: number[] = [];

    if (type === "all") {
      next = [...all];
    } else if (type === "odd") {
      next = all.filter(i => (i + 1) % 2 === 1);
    } else if (type === "even") {
      next = all.filter(i => (i + 1) % 2 === 0);
    } else if (type === "firstHalf") {
      const half = Math.ceil(all.length / 2);
      next = all.slice(0, half);
    } else if (type === "secondHalf") {
      const half = Math.ceil(all.length / 2);
      next = all.slice(half);
    } else if (type === "random5" || type === "random8") {
      const count = type === "random5" ? 5 : 8;
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      next = shuffled.slice(0, Math.min(count, all.length)).sort((a, b) => a - b);
    }

    if (next.length === 0) return;
    setSelectedIndices(next);

    const reconstructed = reconstructQuestionWithSelectedSubItems(
      parsedSubItemsResult.leadInText,
      parsedSubItemsResult.items,
      next,
      parsedSubItemsResult.labelType
    );

    setFormData(prev => prev ? {
      ...prev,
      questionText: reconstructed.newQuestionText,
      answer: reconstructed.newAnswer || prev.answer
    } : null);

    setAnswerLabelsStr(reconstructed.newAnswerLabels.join(", "));
  };

  // ファイルアップロード処理（画像 or 音声）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: "image" | "audio") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (targetType === "image") setIsUploadingImage(true);
    else setIsUploadingAudio(true);

    try {
      const data = new FormData();
      data.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "アップロードに失敗しました");
      }

      setFormData(prev => {
        if (!prev) return null;
        return targetType === "image"
          ? { ...prev, imageUrl: result.url }
          : { ...prev, audioUrl: result.url };
      });
    } catch (err: any) {
      setUploadError(err.message || "アップロード中にエラーが発生しました");
    } finally {
      if (targetType === "image") setIsUploadingImage(false);
      else setIsUploadingAudio(false);
      // input をリセット
      e.target.value = "";
    }
  };

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLabels = answerLabelsStr
      .split(/[,、]/)
      .map(s => s.trim())
      .filter(Boolean);

    onSave({
      ...formData,
      tags,
      figureSvg: formData.figureSvg?.trim() || undefined,
      imageUrl: formData.imageUrl?.trim() || undefined,
      hasImagePlaceholder: formData.hasImagePlaceholder,
      imagePlaceholderText: formData.imagePlaceholderText?.trim() || undefined,
      audioUrl: formData.audioUrl?.trim() || undefined,
      audioScript: formData.audioScript?.trim() || undefined,
      answerLabels: parsedLabels.length > 0 ? parsedLabels : undefined,
      originalQuestionText: baseQuestionText,
      originalAnswer: baseAnswer,
      originalExplanation: baseExplanation,
      isSubItemDisabled: isSubItemDisabled ? true : undefined,
      selectedSubItemIndices: (!isSubItemDisabled && parsedSubItemsResult.hasSubItems) ? selectedIndices : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <span>✏️ 問題の編集・カスタマイズ</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* フォーム入力エリア */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
          {/* 基本属性 (学年・教科書名・教科・単元・サブ論点) */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>基本情報（学年・教科書・単元）</span>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-0.5">
                  <GraduationCap className="w-3 h-3 text-amber-600" />
                  学年 (gr)
                </label>
                <input
                  type="text"
                  placeholder="中2, 中1, 高1"
                  value={formData.grade || ""}
                  onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-600 mb-1 flex items-center gap-0.5">
                  <BookOpen className="w-3 h-3 text-indigo-600" />
                  教科書名 / 教材名 (tb)
                </label>
                <input
                  type="text"
                  placeholder="例: 東京書籍 新しい数学2"
                  value={formData.textbook || ""}
                  onChange={e => setFormData({ ...formData, textbook: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-slate-600 mb-1">ジャンル / 教科 (g)</label>
                <input
                  type="text"
                  required
                  value={formData.genre}
                  onChange={e => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">メイン単元 (t)</label>
                <input
                  type="text"
                  required
                  value={formData.topic}
                  onChange={e => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">サブ論点 (st)</label>
                <input
                  type="text"
                  value={formData.subTopic}
                  onChange={e => setFormData({ ...formData, subTopic: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* タグ (TagInput: リコメンド＆Enter追加) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              タグ (tg) <span className="text-[10px] font-normal text-slate-500">— 類似候補リコメンド表示 ＆ Enterキーで追加</span>
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="タグを入力してEnterで追加 (例: 頻出, 基礎, 計算力)..."
            />
          </div>

          {/* 難易度 & 秒数 & 配点 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">難易度 (1~3)</label>
              <select
                value={formData.difficulty}
                onChange={e =>
                  setFormData({ ...formData, difficulty: parseInt(e.target.value, 10) || 2 })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>★☆☆ (基礎)</option>
                <option value={2}>★★☆ (標準)</option>
                <option value={3}>★★★ (発展)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">想定秒数</label>
              <input
                type="number"
                min="10"
                max="600"
                value={formData.estimatedSeconds}
                onChange={e =>
                  setFormData({ ...formData, estimatedSeconds: parseInt(e.target.value, 10) || 60 })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">配点 (点)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.defaultPoints}
                onChange={e =>
                  setFormData({ ...formData, defaultPoints: parseInt(e.target.value, 10) || 10 })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-indigo-700"
              />
            </div>
          </div>

          {/* 小問の選択・動的リナンバリングセレクター（小問が2問以上ある場合に自動表示） */}
          {parsedSubItemsResult.hasSubItems && (
            <div className="bg-gradient-to-br from-indigo-50/70 to-sky-50/70 border-2 border-indigo-200 rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-indigo-600 text-white rounded-md shadow-2xs">
                    <ListFilter className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <span>大問内の小問選択 ＆ 自動リナンバリング（不要な小問を削る）</span>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                        全 {parsedSubItemsResult.items.length} 問中 {selectedIndices.length} 問 選択中
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      チェックを外すとその小問を削る（削除・非表示）でき、残りの番号（(1)〜や（１）〜、①〜）が1から順に自動で再採番されます
                    </p>
                  </div>
                </div>

                {/* 一括選択ボタングループ & 枝問詳細編集ボタン */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={handleResetSubItemSplit}
                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition"
                    title="枝問の分割を解除し、元の1問完結の問題文・模範解答に戻します"
                  >
                    <Undo2 className="w-3 h-3 text-amber-700" />
                    <span>↩ 枝問分割を解除（1問に戻す）</span>
                  </button>
                  {onOpenSubItemEditor && question && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSubItemEditor(question);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                      title="枝問の追加・不要な行の削除・問題文と解答のインライン編集画面を開く"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>🧩 枝問の追加・削除・詳細編集</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleQuickSelect("all")}
                    className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                  >
                    全選択
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
                  {parsedSubItemsResult.items.length >= 6 && (
                    <button
                      type="button"
                      onClick={() => handleQuickSelect("random5")}
                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded text-[10px] font-bold text-indigo-700 flex items-center gap-0.5 cursor-pointer shadow-2xs"
                    >
                      <Shuffle className="w-2.5 h-2.5" />
                      <span>5問抽出</span>
                    </button>
                  )}
                  {parsedSubItemsResult.items.length >= 9 && (
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
              </div>

              {/* 小問リスト（スクロール可能） */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 bg-white/90 p-2 rounded-lg border border-indigo-100 divide-y divide-slate-100">
                {parsedSubItemsResult.items.map(item => {
                  const isSelected = selectedIndices.includes(item.index);
                  const currentOrder = selectedIndices.indexOf(item.index) + 1;

                  return (
                    <div
                      key={item.index}
                      onClick={() => handleToggleSubItem(item.index)}
                      className={`flex items-start gap-2.5 p-2 rounded-md transition cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/50 hover:bg-indigo-100/50 text-slate-900 border border-indigo-200/80 shadow-2xs"
                          : "bg-slate-50/60 hover:bg-slate-100/60 text-slate-400 opacity-60 border border-transparent"
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-[11px] leading-snug">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold shrink-0 ${isSelected ? "text-indigo-800" : "text-slate-400"}`}>
                            元: {item.originalLabel}
                          </span>
                          {isSelected && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-200">
                              出題 ➔ {formatSubLabel(currentOrder, parsedSubItemsResult.labelType)}
                            </span>
                          )}
                          {item.answerText && (
                            <span className="text-[10px] text-slate-500 truncate bg-slate-100 px-1.5 py-0.2 rounded">
                              解: {item.answerText}
                            </span>
                          )}
                        </div>
                        <div className="font-serif mt-0.5 truncate text-slate-800">
                          {item.promptText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 小問がない単一問題、または枝問分割を解除（無効化）している場合のメニュー */}
          {!parsedSubItemsResult.hasSubItems && (
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ListFilter className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>大問内の枝問（小問）メニュー</span>
                    <span className="text-[10px] text-slate-500 font-normal bg-slate-100 px-1.5 py-0.2 rounded">
                      現在: 1問完結
                    </span>
                    {isSubItemDisabled && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                        枝問分割を解除中
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isSubItemDisabled && canSplitSubItems
                      ? "この問題には枝問パターンが含まれています。再分割すると小問ごとの出題選択が可能になります"
                      : "この問題を複数の枝問 (1), (2)... に分割したり、枝問を追加・編集できます"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSubItemDisabled && canSplitSubItems && (
                  <button
                    type="button"
                    onClick={handleEnableSubItemSplit}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                    title="枝問パターンを再解析して小問選択を再度有効化します"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>✨ 枝問として再分割</span>
                  </button>
                )}
                {onOpenSubItemEditor && question && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSubItemEditor(question);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>🧩 枝問を作成・分割編集</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 問題文 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 text-xs">
                問題文 (TeX数式は \( ... \) または $$ ... $$)
              </label>
              <label className="text-[10px] text-slate-600 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition">
                <input
                  type="checkbox"
                  checked={isSubItemDisabled}
                  onChange={e => {
                    if (e.target.checked) {
                      handleResetSubItemSplit();
                    } else {
                      handleEnableSubItemSplit();
                    }
                  }}
                  className="rounded text-indigo-600 cursor-pointer"
                />
                <span className="font-bold">枝問の自動パース・分割をOFF</span>
              </label>
            </div>
            <p className="text-[10px] text-slate-500 mb-1 leading-normal">
              ※ 文中で <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">(1)</code> や <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">（１）</code> を小問分割させずに使いたい場合は、<code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">&quot;(1)&quot;</code> や <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-slate-700">「（１）」</code> で囲むか、右上の「枝問の自動パース・分割をOFF」にしてください。
            </p>
            <textarea
              required
              rows={3}
              value={formData.questionText}
              onChange={e => {
                const val = e.target.value;
                setFormData(prev => prev ? { ...prev, questionText: val } : null);
                if (isSubItemDisabled) {
                  setBaseQuestionText(val);
                }
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-serif leading-relaxed text-xs"
            />
          </div>

          {/* 解答 & 解説 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">模範解答</label>
              <textarea
                required
                rows={2}
                value={formData.answer}
                onChange={e => setFormData({ ...formData, answer: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-serif"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">解説 (省略可)</label>
              <textarea
                rows={2}
                value={formData.explanation}
                onChange={e => setFormData({ ...formData, explanation: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-600"
              />
            </div>
          </div>

          {/* 複数解答欄ラベル（任意） */}
          <div>
            <label className="block font-bold text-slate-700 mb-0.5">
              解答欄ラベル (任意: カンマ区切り)
            </label>
            <p className="text-[10px] text-slate-500 mb-1">
              ※ 未入力の場合は問題文や模範解答から自動検出します（例: <code className="bg-slate-100 px-1 py-0.5 rounded">yの値, xの増加量, yの増加量</code> または <code className="bg-slate-100 px-1 py-0.5 rounded">(1), (2)</code>）。
            </p>
            <input
              type="text"
              placeholder="例: yの値, xの増加量, yの増加量"
              value={answerLabelsStr}
              onChange={e => setAnswerLabelsStr(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono text-xs"
            />
          </div>

          {/* 解答欄のレイアウト形式 */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              解答欄のレイアウト形式
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, answerLayout: "auto" })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  formData.answerLayout === "auto" || !formData.answerLayout
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                🪄 自動判定
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, answerLayout: "same-line" })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  formData.answerLayout === "same-line"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
                title="問題文の右側に解答欄を同一行配置（英単語・短問用）"
              >
                ➡️ 同一行 (単語)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, answerLayout: "inline" })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  formData.answerLayout === "inline"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ↔ 横並び (下部)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, answerLayout: "stacked" })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                  formData.answerLayout === "stacked"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ☰ 各問1行 (記述)
              </button>
            </div>
          </div>

          {/* エラーメッセージ */}
          {uploadError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* 画像・イラスト設定（問題ごとのディレクトリ/パス指定 ＆ アップロード ＆ 画像欄枠） */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                問題画像・イラスト・画像欄 (任意: 絵を見て答える問題・リスニング場面・地図等)
              </label>
              <span className="text-[10px] text-slate-400 font-normal">画像パス指定 または 画像欄枠表示</span>
            </div>

            {/* 絵を見て答える問題（画像欄プレースホルダー）のトグル */}
            <div className="p-2 bg-white rounded border border-slate-200 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!formData.hasImagePlaceholder}
                  onChange={e => {
                    const checked = e.target.checked;
                    setFormData({
                      ...formData,
                      hasImagePlaceholder: checked ? true : undefined,
                      imagePlaceholderText: checked ? (formData.imagePlaceholderText || "画像欄") : undefined
                    });
                  }}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">
                  🖼️ 絵を見て答える問題（印刷用紙に「画像欄」枠を表示する）
                </span>
              </label>

              {formData.hasImagePlaceholder && (
                <div className="pl-5 pt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium">画像欄ラベル:</span>
                    <input
                      type="text"
                      placeholder="例: 画像欄, 公園のイラスト, 時計の絵 など"
                      value={formData.imagePlaceholderText || ""}
                      onChange={e => setFormData({ ...formData, imagePlaceholderText: e.target.value })}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-slate-50"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ※ 画像ファイルが無くても、印刷用紙に実線/点線の画像枠が確保されます（Mini-JSON "img": "画像欄" に対応）。
                  </p>
                </div>
              )}

              {/* 問題文から絵を見て答える問題であることを検知した場合のクイックサジェスト */}
              {!formData.hasImagePlaceholder && !formData.imageUrl && /(?:絵|イラスト|図|写真)を見て/i.test(formData.questionText) && (
                <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-[10.5px] text-amber-800">
                  <span>💡 問題文に「絵を見て」が含まれています。画像欄枠を有効にしますか？</span>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      hasImagePlaceholder: true,
                      imagePlaceholderText: "画像欄"
                    })}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] transition cursor-pointer"
                  >
                    画像欄を有効化
                  </button>
                </div>
              )}
            </div>

            {/* パス/ディレクトリ入力 ＆ ファイル選択 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-slate-600">実際の画像ファイル（任意）:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="例: /uploads/images/... または /images/english/lesson1/map.png"
                    value={formData.imageUrl || ""}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value || undefined })}
                    className="w-full pl-2 pr-7 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  />
                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: undefined })}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
                      title="画像パスをクリア"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    disabled={isUploadingImage}
                    onChange={e => handleFileUpload(e, "image")}
                  />
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span className="text-[11px]">アップロード中...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[11px]">ファイル選択</span>
                    </>
                  )}
                </label>
              </div>

              <p className="text-[10px] text-slate-500">
                💡 ファイルを選択して自動保存するか、問題ごとの画像ディレクトリ（例: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-700">/images/ch1/q1.png</code>）を直接入力してください。
              </p>

              {/* プレビュー */}
              {formData.imageUrl ? (
                <div className="flex items-center gap-3 bg-white p-2 rounded border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.imageUrl}
                    alt="プレビュー"
                    className="w-16 h-14 object-contain rounded border border-slate-100 bg-slate-50 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-slate-700 truncate">{formData.imageUrl}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">✓ 画像が指定されています（用紙に自動レイアウト）</p>
                  </div>
                </div>
              ) : formData.hasImagePlaceholder ? (
                <div className="flex items-center gap-3 bg-amber-50/50 p-2 rounded border border-amber-200">
                  <div className="w-16 h-14 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-white text-slate-400 shrink-0 select-none">
                    <ImageIcon className="w-4 h-4 mb-0.5 opacity-60" />
                    <span className="text-[9px] font-bold">画像欄</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-amber-900">
                      ✓ 「{formData.imagePlaceholderText || "画像欄"}」枠を用紙に印刷
                    </p>
                    <p className="text-[10px] text-slate-500">
                      用紙プレビューと印刷時に、イラスト・図版用の枠が自動配置されます。
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* リスニング設定（問題ごとの音声ディレクトリ/パス指定 ＆ 放送台本） */}
          <div className="bg-indigo-50/40 p-3 rounded-lg border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                リスニング設定 (任意: 音声ディレクトリ・放送台本)
              </label>
              <span className="text-[10px] text-slate-400 font-normal">問題ごとに個別パス・ディレクトリ指定可</span>
            </div>

            {/* 音声パス / ディレクトリ指定 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="例: /uploads/audio/... または /audio/english/unit1/dialogue.mp3"
                    value={formData.audioUrl || ""}
                    onChange={e => setFormData({ ...formData, audioUrl: e.target.value || undefined })}
                    className="w-full pl-2 pr-7 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  />
                  {formData.audioUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, audioUrl: undefined })}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
                      title="音声パスをクリア"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="shrink-0 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs">
                  <input
                    type="file"
                    accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg"
                    className="hidden"
                    disabled={isUploadingAudio}
                    onChange={e => handleFileUpload(e, "audio")}
                  />
                  {isUploadingAudio ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span className="text-[11px]">アップロード中...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[11px]">ファイル選択</span>
                    </>
                  )}
                </label>
              </div>

              {/* 試聴プレイヤー */}
              {formData.audioUrl && (
                <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-indigo-200">
                  <audio controls src={formData.audioUrl} className="h-7 flex-1" />
                </div>
              )}
            </div>

            {/* 放送台本（スクリプト） */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">放送台本・スクリプト（原稿）</span>
                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  ※ 生徒用用紙には印刷されず、教師用解答プリントにのみ印字されます
                </span>
              </div>
              <textarea
                rows={2}
                placeholder="例: Look at the map. You are at the station. Turn right at the second corner... Where are you?"
                value={formData.audioScript || ""}
                onChange={e => setFormData({ ...formData, audioScript: e.target.value || undefined })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs"
              />
            </div>
          </div>

          {/* SVG図形コード */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              SVG図形コード (数式・幾何問題のみ任意: &lt;svg ...&gt;...&lt;/svg&gt;)
            </label>
            <textarea
              rows={2}
              placeholder="<svg viewBox='0 0 160 120'>...</svg>"
              value={formData.figureSvg || ""}
              onChange={e => setFormData({ ...formData, figureSvg: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono text-[11px]"
            />
          </div>

          {/* モーダルフッター */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md flex items-center gap-1.5 shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              保存して反映
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
