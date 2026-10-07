"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Question } from "@/types/quiz";
import { importQuestionsFromTsv, importQuestionsFromMiniJson } from "@/lib/storage";
import {
  parseSubItems,
  reconstructQuestionWithSelectedSubItems,
  formatSubLabel
} from "@/lib/subItemUtils";
import { TagInput } from "./TagInput";
import { MathText } from "./MathText";
import { SubItemEditorModal } from "./SubItemEditorModal";
import { buildMaterialExtractionPrompt } from "@/lib/importPromptUtils";
import {
  mergeQuestions,
  unmergeQuestion,
  unmergeAllQuestions,
  autoGroupAndMergeQuestions
} from "@/lib/questionMergeUtils";
import {
  X,
  Table,
  FileJson,
  Copy,
  Check,
  ArrowDownToLine,
  BookOpen,
  GraduationCap,
  Tag as TagIcon,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ListFilter,
  Layers,
  Edit3,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  CheckSquare,
  Square,
  Combine,
  FolderTree
} from "lucide-react";

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
  // ステップ管理: "input" (テキスト入力) | "preview" (枝問設定・プレビュー)
  const [step, setStep] = useState<"input" | "preview">("input");
  const [activeTab, setActiveTab] = useState<"tsv" | "json">("json");
  const [inputText, setInputText] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  // 大問・セクションごとの自動集約オプション（デフォルト有効）
  const [autoMergeBySection, setAutoMergeBySection] = useState(true);
  // 手動選択マージ用チェックリスト
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // フォールバック基本情報
  const [fallbackGrade, setFallbackGrade] = useState(defaultGrade);
  const [fallbackTextbook, setFallbackTextbook] = useState(defaultTextbook);
  const [fallbackTags, setFallbackTags] = useState<string[]>([]);

  // パース済み問題リスト（プレビュー・設定用）
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);

  // 枝問詳細編集モーダル連携
  const [editingSubItemIndex, setEditingSubItemIndex] = useState<number | null>(null);
  const [editingSubItemQuestion, setEditingSubItemQuestion] = useState<Question | null>(null);

  // プレビュー時の表示フィルター
  const [subItemFilter, setSubItemFilter] = useState<"all" | "has_sub" | "single">("all");

  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setFallbackGrade(defaultGrade);
      setFallbackTextbook(defaultTextbook);
      setFallbackTags([]);
      setErrorMsg("");
      setParsedQuestions([]);
      setSelectedQuestionIds([]);
      setEditingSubItemIndex(null);
      setEditingSubItemQuestion(null);
    }
  }, [isOpen, defaultGrade, defaultTextbook]);

  // 枝問を含む問題数の集計
  const subItemStats = useMemo(() => {
    let hasSubCount = 0;
    let enabledCount = 0;
    parsedQuestions.forEach(q => {
      const baseQ = q.originalQuestionText || q.questionText;
      const baseA = q.originalAnswer || q.answer;
      const baseE = q.originalExplanation || q.explanation || "";
      const parsed = parseSubItems(baseQ, baseA, baseE, false);
      if (parsed.hasSubItems) {
        hasSubCount++;
        if (!q.isSubItemDisabled) {
          enabledCount++;
        }
      }
    });
    return { hasSubCount, enabledCount, total: parsedQuestions.length };
  }, [parsedQuestions]);

  // マージされた大問が存在するかどうかの判定
  const hasMergedQuestions = useMemo(() => {
    return parsedQuestions.some(q => q.mergedQuestions && q.mergedQuestions.length > 0);
  }, [parsedQuestions]);

  // フィルタリングされた問題リスト
  const filteredQuestions = useMemo(() => {
    if (subItemFilter === "all") return parsedQuestions;
    return parsedQuestions.filter(q => {
      const baseQ = q.originalQuestionText || q.questionText;
      const baseA = q.originalAnswer || q.answer;
      const baseE = q.originalExplanation || q.explanation || "";
      const parsed = parseSubItems(baseQ, baseA, baseE, false);
      if (subItemFilter === "has_sub") return parsed.hasSubItems;
      return !parsed.hasSubItems;
    });
  }, [parsedQuestions, subItemFilter]);

  const sampleAiPrompt = useMemo(() => {
    return buildMaterialExtractionPrompt({
      grade: fallbackGrade,
      textbook: fallbackTextbook,
      tags: fallbackTags
    });
  }, [fallbackGrade, fallbackTextbook, fallbackTags]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(sampleAiPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // 枝問自動パース・初期設定ユーティリティ
  const processQuestionsWithSubItems = (questions: Question[]): Question[] => {
    return questions.map(q => {
      const baseQ = q.originalQuestionText || q.questionText;
      const baseA = q.originalAnswer || q.answer;
      const baseE = q.originalExplanation || q.explanation || "";

      const parsed = parseSubItems(baseQ, baseA, baseE, false);

      if (parsed.hasSubItems) {
        const isDisabled = !!q.isSubItemDisabled;
        if (!isDisabled) {
          const allIndices = parsed.items.map(it => it.index);
          const selected = (q.selectedSubItemIndices && q.selectedSubItemIndices.length > 0)
            ? q.selectedSubItemIndices.filter(i => i < parsed.items.length)
            : allIndices;

          const reconstructed = reconstructQuestionWithSelectedSubItems(
            parsed.leadInText,
            parsed.items,
            selected,
            parsed.labelType
          );

          return {
            ...q,
            originalQuestionText: baseQ,
            originalAnswer: baseA,
            originalExplanation: baseE,
            questionText: reconstructed.newQuestionText,
            answer: reconstructed.newAnswer,
            answerLabels: reconstructed.newAnswerLabels,
            selectedSubItemIndices: selected,
            isSubItemDisabled: false
          };
        } else {
          return {
            ...q,
            originalQuestionText: baseQ,
            originalAnswer: baseA,
            originalExplanation: baseE,
            isSubItemDisabled: true
          };
        }
      }

      return q;
    });
  };

  // Step 1 ➔ Step 2: テキストを解析して枝問プレビュー・設定画面へ遷移
  const handleParseAndGoToPreview = () => {
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

      // 大問・セクションごとの自動集約が有効な場合、グルーピングしてマージ
      let candidateQuestions = imported;
      if (autoMergeBySection) {
        candidateQuestions = autoGroupAndMergeQuestions(imported);
      }

      // 各問題の枝問を原則として自動解析して初期設定
      const processed = processQuestionsWithSubItems(candidateQuestions);

      setParsedQuestions(processed);
      setSelectedQuestionIds([]);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg("解析に失敗しました: " + (err?.message || "形式不正"));
    }
  };

  // 大問ごとに自動集約
  const handleAutoMerge = () => {
    const unmerged = unmergeAllQuestions(parsedQuestions);
    const merged = autoGroupAndMergeQuestions(unmerged);
    const processed = processQuestionsWithSubItems(merged);
    setParsedQuestions(processed);
    setSelectedQuestionIds([]);
  };

  // 全解除（元のバラバラ問題に戻す）
  const handleUnmergeAll = () => {
    const unmerged = unmergeAllQuestions(parsedQuestions);
    const processed = processQuestionsWithSubItems(unmerged);
    setParsedQuestions(processed);
    setSelectedQuestionIds([]);
  };

  // 単一問題のマージ解除
  const handleUnmergeSingle = (questionId: string) => {
    setParsedQuestions(prev => {
      const next: Question[] = [];
      for (const q of prev) {
        if (q.id === questionId && q.mergedQuestions && q.mergedQuestions.length > 0) {
          const unmerged = unmergeQuestion(q);
          next.push(...processQuestionsWithSubItems(unmerged));
        } else {
          next.push(q);
        }
      }
      return next;
    });
    setSelectedQuestionIds(prev => prev.filter(id => id !== questionId));
  };

  // チェックボックス選択トグル
  const handleToggleSelectQuestion = (questionId: string) => {
    setSelectedQuestionIds(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId);
      }
      return [...prev, questionId];
    });
  };

  // 選択した問題を1つにまとめる（手動マージ）
  const handleMergeSelected = () => {
    if (selectedQuestionIds.length < 2) return;
    const toMerge: Question[] = [];
    const rest: Question[] = [];
    let insertIndex = -1;

    parsedQuestions.forEach(q => {
      if (selectedQuestionIds.includes(q.id)) {
        if (insertIndex === -1) insertIndex = rest.length;
        toMerge.push(...unmergeQuestion(q));
      } else {
        rest.push(q);
      }
    });

    if (toMerge.length >= 2) {
      const merged = mergeQuestions(toMerge);
      const processedMerged = processQuestionsWithSubItems([merged])[0];
      rest.splice(insertIndex, 0, processedMerged);
      setParsedQuestions(rest);
      setSelectedQuestionIds([]);
    }
  };

  // 枝問分割のON/OFF切替
  const handleToggleSubItemDisabled = (index: number) => {
    setParsedQuestions(prev => {
      const next = [...prev];
      const target = next[index];
      const baseQ = target.originalQuestionText || target.questionText;
      const baseA = target.originalAnswer || target.answer;
      const baseE = target.originalExplanation || target.explanation || "";
      const currentlyDisabled = !!target.isSubItemDisabled;

      if (currentlyDisabled) {
        // 枝問分割を有効化
        const parsed = parseSubItems(baseQ, baseA, baseE, false);
        if (parsed.hasSubItems) {
          const allIndices = parsed.items.map(it => it.index);
          const selected = (target.selectedSubItemIndices && target.selectedSubItemIndices.length > 0)
            ? target.selectedSubItemIndices
            : allIndices;
          const reconstructed = reconstructQuestionWithSelectedSubItems(
            parsed.leadInText,
            parsed.items,
            selected,
            parsed.labelType
          );
          next[index] = {
            ...target,
            originalQuestionText: baseQ,
            originalAnswer: baseA,
            originalExplanation: baseE,
            questionText: reconstructed.newQuestionText,
            answer: reconstructed.newAnswer,
            answerLabels: reconstructed.newAnswerLabels,
            selectedSubItemIndices: selected,
            isSubItemDisabled: false
          };
        }
      } else {
        // 枝問分割を無効化（1問完結に戻す）
        next[index] = {
          ...target,
          originalQuestionText: baseQ,
          originalAnswer: baseA,
          originalExplanation: baseE,
          questionText: baseQ,
          answer: baseA,
          explanation: baseE,
          answerLabels: undefined,
          selectedSubItemIndices: undefined,
          isSubItemDisabled: true
        };
      }
      return next;
    });
  };

  // 全問題の枝問分割を一括でON / OFF
  const handleBulkToggleSubItems = (enable: boolean) => {
    setParsedQuestions(prev => {
      return prev.map(target => {
        const baseQ = target.originalQuestionText || target.questionText;
        const baseA = target.originalAnswer || target.answer;
        const baseE = target.originalExplanation || target.explanation || "";

        const parsed = parseSubItems(baseQ, baseA, baseE, false);
        if (!parsed.hasSubItems) return target;

        if (enable) {
          const allIndices = parsed.items.map(it => it.index);
          const selected = (target.selectedSubItemIndices && target.selectedSubItemIndices.length > 0)
            ? target.selectedSubItemIndices
            : allIndices;
          const reconstructed = reconstructQuestionWithSelectedSubItems(
            parsed.leadInText,
            parsed.items,
            selected,
            parsed.labelType
          );
          return {
            ...target,
            originalQuestionText: baseQ,
            originalAnswer: baseA,
            originalExplanation: baseE,
            questionText: reconstructed.newQuestionText,
            answer: reconstructed.newAnswer,
            answerLabels: reconstructed.newAnswerLabels,
            selectedSubItemIndices: selected,
            isSubItemDisabled: false
          };
        } else {
          return {
            ...target,
            originalQuestionText: baseQ,
            originalAnswer: baseA,
            originalExplanation: baseE,
            questionText: baseQ,
            answer: baseA,
            explanation: baseE,
            answerLabels: undefined,
            selectedSubItemIndices: undefined,
            isSubItemDisabled: true
          };
        }
      });
    });
  };

  // 枝問詳細エディタモーダルを開く
  const handleOpenSubItemEditor = (index: number) => {
    setEditingSubItemIndex(index);
    setEditingSubItemQuestion({ ...parsedQuestions[index] });
  };

  // 枝問詳細エディタでの編集内容を反映
  const handleSaveSubItemFromEditor = (updatedQuestion: Question) => {
    if (editingSubItemIndex !== null) {
      setParsedQuestions(prev => {
        const next = [...prev];
        next[editingSubItemIndex] = updatedQuestion;
        return next;
      });
    }
    setEditingSubItemQuestion(null);
    setEditingSubItemIndex(null);
  };

  // 最終インポート実行
  const handleExecuteImport = () => {
    if (parsedQuestions.length === 0) return;
    onImportSuccess(parsedQuestions, skipDuplicates);
    setInputText("");
    setParsedQuestions([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div
          className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full ${
            step === "preview" ? "max-w-4xl max-h-[94vh]" : "max-w-2xl max-h-[92vh]"
          } flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 transition-all`}
        >
          {/* ヘッダー */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="font-bold text-sm">
                  {step === "input"
                    ? "問題の一括取込（Mini-JSON / スプレッドシート）"
                    : "問題インポート ＆ 枝問（小問）プレビュー設定"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {step === "input"
                    ? "外部AI出力のJSONまたはTSVから問題を一括登録"
                    : `全 ${parsedQuestions.length} 問中、枝問検出: ${subItemStats.hasSubCount} 問（有効: ${subItemStats.enabledCount} 問）`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {step === "input" ? (
            /* ============================== STEP 1: データ入力画面 ============================== */
            <>
              {/* タブナビ */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 text-xs">
                <button
                  onClick={() => {
                    setActiveTab("json");
                    setErrorMsg("");
                  }}
                  className={`px-4 py-2 font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
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
                  className={`px-4 py-2 font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === "tsv"
                      ? "border-emerald-600 text-emerald-800 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  Googleスプレッドシート（TSV貼り付け）
                </button>
              </div>

              {/* 入力フォームコンテンツ */}
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
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-[11px] text-indigo-900 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold flex items-center gap-1 text-indigo-950">
                            💡 外部AI（Gemini / ChatGPT / Claude）用プロンプト
                          </span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono font-semibold">
                            ```json コードブロック指定済
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                            単語表・重要語句も1語ずつ問題化
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={copyPrompt}
                          className="px-2.5 py-1 bg-white border border-indigo-300 hover:bg-indigo-100 rounded text-[10px] font-bold text-indigo-700 flex items-center gap-1 shadow-2xs transition cursor-pointer"
                        >
                          {copiedPrompt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedPrompt ? "コピー完了！" : "プロンプトをコピー"}
                        </button>
                      </div>
                      <p className="text-indigo-950 text-[10px] font-mono leading-relaxed bg-white/80 p-2 rounded border border-indigo-100 max-h-24 overflow-y-auto whitespace-pre-wrap select-all">
                        {sampleAiPrompt}
                      </p>
                      <div className="text-[10px] text-indigo-800 bg-indigo-100/70 px-2 py-1 rounded flex items-center gap-1.5">
                        <span className="font-bold text-indigo-950 shrink-0">📌 取り込みのコツ:</span>
                        <span>長大なPDFはAIの出力文字数上限を超えるため、<strong>見開き1〜2ページ（1レッスン分）ずつ</strong>渡すと、単語表や小問も一切取りこぼさず100%確実に抽出できます。</span>
                      </div>
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
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={e => setSkipDuplicates(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-medium text-[11px]">
                      重複問題をマージ補完
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-indigo-950 bg-indigo-100/70 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300 cursor-pointer select-none transition">
                    <input
                      type="checkbox"
                      checked={autoMergeBySection}
                      onChange={e => setAutoMergeBySection(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-[11px] flex items-center gap-1">
                      <Combine className="w-3 h-3 text-indigo-600" />
                      大問・単元ごとに自動集約（推奨）
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-md transition text-xs cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleParseAndGoToPreview}
                    className={`px-5 py-1.5 text-white font-bold rounded-md shadow-xs transition text-xs flex items-center gap-1.5 cursor-pointer ${
                      activeTab === "tsv"
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-indigo-600 hover:bg-indigo-500"
                    }`}
                  >
                    <span>解析して枝問プレビュー・設定へ</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ============================== STEP 2: 枝問プレビュー・設定画面 ============================== */
            <>
              {/* コントロール・サマリーバー */}
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* 絞り込みフィルタータブ ＆ 大問まとめボタン群 */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      onClick={() => setSubItemFilter("all")}
                      className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                        subItemFilter === "all"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      すべて ({parsedQuestions.length})
                    </button>
                    <button
                      onClick={() => setSubItemFilter("has_sub")}
                      className={`px-2.5 py-1 rounded font-bold transition flex items-center gap-1 cursor-pointer ${
                        subItemFilter === "has_sub"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ListFilter className="w-3 h-3" />
                      枝問あり ({subItemStats.hasSubCount})
                    </button>
                    <button
                      onClick={() => setSubItemFilter("single")}
                      className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                        subItemFilter === "single"
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      1問完結 ({parsedQuestions.length - subItemStats.hasSubCount})
                    </button>
                  </div>

                  {/* 大問自動集約・全解除ボタン群 */}
                  <div className="flex items-center gap-1 bg-indigo-50/80 p-0.5 px-2 rounded-lg border border-indigo-200 text-[11px]">
                    <span className="text-[10px] text-indigo-950 font-bold flex items-center gap-1">
                      <Combine className="w-3 h-3 text-indigo-600" />
                      大問まとめ:
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoMerge}
                      className="px-2 py-0.5 bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-700 font-bold rounded text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                      title="同一単元・サブ論点の問題群を自動で1つの大問に統合します"
                    >
                      自動集約
                    </button>
                    {hasMergedQuestions && (
                      <button
                        type="button"
                        onClick={handleUnmergeAll}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 font-semibold rounded text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                        title="まとめた大問をすべて元のバラバラな問題に戻します"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        全解除
                      </button>
                    )}
                  </div>
                </div>

                {/* 一括操作ボタン */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-medium">枝問一括操作:</span>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleSubItems(true)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-semibold rounded text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                    title="枝問パターンが含まれる全問題の分割を有効にします"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    全問分割を有効
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkToggleSubItems(false)}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-300 text-slate-700 hover:text-amber-700 font-semibold rounded text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                    title="全問題を枝問分割せず1問完結として取り込みます"
                  >
                    <Layers className="w-3 h-3 text-amber-600" />
                    全問1問完結にする
                  </button>
                </div>
              </div>

              {/* 手動選択マージ用フローティングアクションバー */}
              {selectedQuestionIds.length > 0 && (
                <div className="px-5 py-2 bg-gradient-to-r from-indigo-50 via-amber-50 to-indigo-50 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-slate-900">
                      {selectedQuestionIds.length} 問を選択中
                    </span>
                    <span className="text-[10px] text-slate-500">
                      （選択した問題を1つの大問にまとめられます）
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionIds([])}
                      className="px-2 py-0.5 text-slate-600 hover:text-slate-800 text-[11px] font-semibold cursor-pointer"
                    >
                      選択解除
                    </button>
                    <button
                      type="button"
                      disabled={selectedQuestionIds.length < 2}
                      onClick={handleMergeSelected}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white font-bold rounded text-[11px] shadow-xs transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Combine className="w-3.5 h-3.5" />
                      <span>選択した {selectedQuestionIds.length} 問を1つの大問にまとめる</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 案内バナー */}
              <div className="px-5 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    原則として<strong>（１）/ (1)</strong> や <strong>①</strong> などの枝問は自動分割されています。必要に応じて「大問まとめ」や「🧩 枝問を詳細編集」で修正してください。
                  </span>
                </div>
              </div>

              {/* 問題リストプレビュー領域 */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 divide-y divide-slate-100">
                {filteredQuestions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    該当する問題がありません。
                  </div>
                ) : (
                  filteredQuestions.map((q, filteredIdx) => {
                    // 全体配列内の元のインデックスを特定
                    const actualIdx = parsedQuestions.findIndex(item => item.id === q.id);
                    const idx = actualIdx !== -1 ? actualIdx : filteredIdx;

                    const baseQ = q.originalQuestionText || q.questionText;
                    const baseA = q.originalAnswer || q.answer;
                    const baseE = q.originalExplanation || q.explanation || "";

                    const parsed = parseSubItems(baseQ, baseA, baseE, false);
                    const hasSub = parsed.hasSubItems;
                    const isSubDisabled = !!q.isSubItemDisabled;

                    // ラベル形式名称
                    const labelTypeName = parsed.labelType === "fullParen"
                      ? "（１）全角括弧"
                      : parsed.labelType === "circled"
                      ? "① 丸数字"
                      : "(1) 半角括弧";

                    return (
                      <div
                        key={q.id || idx}
                        className={`pt-3 first:pt-0 p-3.5 rounded-xl border transition-all ${
                          hasSub && !isSubDisabled
                            ? "bg-gradient-to-r from-indigo-50/30 via-white to-indigo-50/10 border-indigo-200 shadow-2xs"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        {/* 問題カード上部メタ情報 ＆ 枝問ステータス */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={selectedQuestionIds.includes(q.id)}
                              onChange={() => handleToggleSelectQuestion(q.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mr-0.5"
                              title="この問題を選択してまとめる"
                            />
                            <span className="font-bold text-slate-900 text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                              #{idx + 1}
                            </span>
                            {q.mergedQuestions && q.mergedQuestions.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                                  <Combine className="w-3 h-3 text-indigo-600" />
                                  大問統合済 ({q.mergedQuestions.length}問)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnmergeSingle(q.id)}
                                  className="px-1.5 py-0.5 text-[9px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition cursor-pointer flex items-center gap-0.5 font-medium"
                                  title="この大問を元の個別問題に分解します"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  分解
                                </button>
                              </div>
                            )}
                            {q.grade && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">
                                {q.grade}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                              {q.genre}
                            </span>
                            <span className="text-[11px] font-bold text-slate-800">
                              {q.topic}
                            </span>
                            {q.subTopic && (
                              <span className="text-[10px] text-slate-500">
                                / {q.subTopic}
                              </span>
                            )}
                            {q.imageUrl ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-sky-50 text-sky-700 rounded border border-sky-200">
                                🖼️ 画像
                              </span>
                            ) : q.hasImagePlaceholder ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded border border-amber-300">
                                🖼️ 画像欄
                              </span>
                            ) : null}
                            {q.tags && q.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 ml-1">
                                {q.tags.slice(0, 3).map(tag => (
                                  <span
                                    key={tag}
                                    className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-600 rounded"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                                {q.tags.length > 3 && (
                                  <span className="text-[9px] text-slate-400">
                                    +{q.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 枝問コントロールボタン群 */}
                          <div className="flex items-center gap-1.5">
                            {hasSub ? (
                              <>
                                {/* 枝問ありバッジ */}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                                  <ListFilter className="w-3 h-3 text-indigo-600" />
                                  <span>枝問 {parsed.items.length}問</span>
                                  <span className="text-[9px] font-normal text-indigo-600">
                                    ({labelTypeName})
                                  </span>
                                </span>

                                {/* 分割ON/OFFトグル */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubItemDisabled(idx)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                    !isSubDisabled
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                      : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                  }`}
                                  title={!isSubDisabled ? "クリックで枝問分割を解除（1問完結に戻す）" : "クリックで枝問分割を再有効化"}
                                >
                                  {!isSubDisabled ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>枝問分割: ON</span>
                                    </>
                                  ) : (
                                    <>
                                      <Layers className="w-3 h-3 text-amber-600" />
                                      <span>1問完結 (解除中)</span>
                                    </>
                                  )}
                                </button>

                                {/* 枝問詳細編集モーダル呼び出し */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubItemEditor(idx)}
                                  className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>枝問を詳細編集</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  1問完結
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubItemEditor(idx)}
                                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium rounded text-[10px] transition cursor-pointer flex items-center gap-1"
                                  title="手動で枝問を追加・分割します"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-600" />
                                  <span>枝問を設定</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* 問題文プレビュー */}
                        <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1.5 border border-slate-100">
                          <div>
                            <span className="font-bold text-slate-500 text-[10px] mr-1">問:</span>
                            <MathText
                              text={q.questionText}
                              className="text-slate-800 leading-relaxed inline"
                            />
                          </div>
                          <div className="text-[11px] text-slate-600 border-t border-slate-200/60 pt-1 flex items-start gap-1">
                            <span className="font-bold text-emerald-600 text-[10px] shrink-0">答:</span>
                            <MathText
                              text={q.answer}
                              className="text-slate-700 leading-relaxed"
                            />
                          </div>

                          {/* 枝問分割が有効な場合の枝問リスト抜粋プレビュー */}
                          {hasSub && !isSubDisabled && parsed.items.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-indigo-100/80 bg-white/80 p-2 rounded border border-indigo-100">
                              <div className="text-[10px] font-bold text-indigo-900 mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <ListFilter className="w-3 h-3 text-indigo-600" />
                                  構成小問一覧（{parsed.items.length}項目）:
                                </span>
                                {q.answerLabels && q.answerLabels.length > 0 && (
                                  <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                                    解答欄: {q.answerLabels.join(", ")}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                {parsed.items.map((item, itemIdx) => {
                                  const label = formatSubLabel(itemIdx + 1, parsed.labelType);
                                  return (
                                    <div
                                      key={itemIdx}
                                      className="flex items-center gap-1.5 p-1 rounded bg-slate-50 border border-slate-100 text-[10px] overflow-hidden"
                                    >
                                      <span className="font-bold text-indigo-800 shrink-0 bg-indigo-100 px-1 rounded">
                                        {label}
                                      </span>
                                      <span className="truncate text-slate-700">
                                        {item.promptText || item.rawLine}
                                      </span>
                                      {item.answerText && (
                                        <span className="text-emerald-700 font-mono text-[9px] shrink-0 ml-auto bg-emerald-50 px-1 rounded border border-emerald-100 truncate max-w-[90px]">
                                          {item.answerText}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* プレビューフッター */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-md transition text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>入力に戻る</span>
                </button>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={e => setSkipDuplicates(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-medium text-[11px]">
                      重複問題をスキップ
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-md transition text-xs cursor-pointer"
                  >
                    キャンセル
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md shadow-xs transition text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>{parsedQuestions.length}問を問題プールにインポート</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 枝問詳細編集モーダル（インポート前の個別問題に対して開く） */}
      {editingSubItemQuestion && (
        <SubItemEditorModal
          isOpen={true}
          question={editingSubItemQuestion}
          mode="master"
          onClose={() => {
            setEditingSubItemQuestion(null);
            setEditingSubItemIndex(null);
          }}
          onSave={handleSaveSubItemFromEditor}
        />
      )}
    </>
  );
};
