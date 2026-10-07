"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Question, QuizTest, TestSection, AppSettings } from "@/types/quiz";
import {
  loadQuestionPool,
  loadQuestionPoolAsync,
  saveQuestionPool,
  loadCurrentTest,
  loadCurrentTestAsync,
  saveCurrentTest,
  loadAppSettings,
  saveAppSettings,
  DEFAULT_APP_SETTINGS,
  exportQuestionsToTsv,
  exportQuestionsToMiniJson
} from "@/lib/storage";
import { recalculateTestScores, calculateCurrentTotal } from "@/lib/scoring";
import { generateSectionTitleFromQuestions } from "@/lib/sectionUtils";
import { extractSubQuestionLabels, resolveAnswerLayout } from "@/lib/answerUtils";
import { mergeQuestions, unmergeQuestion } from "@/lib/questionMergeUtils";
import { getMaxPageNumber } from "@/lib/pageUtils";
import { Header } from "@/components/Header";
import { Step1Pool } from "@/components/Step1Pool";
import { Step2Builder } from "@/components/Step2Builder";
import { Step3Preview } from "@/components/Step3Preview";
import { EditQuestionModal } from "@/components/EditQuestionModal";
import { SubItemEditorModal } from "@/components/SubItemEditorModal";
import { ImportExportModal } from "@/components/ImportExportModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { GenerateSimilarPromptModal } from "@/components/GenerateSimilarPromptModal";
import { StorageManagerModal } from "@/components/StorageManagerModal";

export default function Home() {
  // 状態管理
  const [pool, setPool] = useState<Question[]>([]);
  const [test, setTest] = useState<QuizTest | null>(null);
  const [testHistory, setTestHistory] = useState<QuizTest[]>([]); // Undo用履歴スタック
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [sheetMode, setSheetMode] = useState<"student" | "teacher">("student");
  const [isLoaded, setIsLoaded] = useState(false);

  // モーダル管理
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTargetPosition, setEditTargetPosition] = useState<{ secIdx: number; qIdx: number } | null>(null);

  // 枝問（小問）編集モーダル
  const [subItemModalQuestion, setSubItemModalQuestion] = useState<Question | null>(null);
  const [isSubItemModalOpen, setIsSubItemModalOpen] = useState(false);
  const [subItemModalPosition, setSubItemModalPosition] = useState<{ secIdx: number; qIdx: number } | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [similarPromptQuestion, setSimilarPromptQuestion] = useState<Question | null>(null);
  const [isSimilarPromptModalOpen, setIsSimilarPromptModalOpen] = useState(false);

  // Step 1 プール削除確認モーダル & 復元キャッシュ
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [recentlyDeletedPoolQuestion, setRecentlyDeletedPoolQuestion] = useState<Question | null>(null);

  // 通知トースト
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ★ PDF保存時の初期ファイル名連動 ★
  // ブラウザの印刷・PDF出力ダイアログは document.title を初期ファイル名に使用するため、テスト名と同期
  useEffect(() => {
    if (test?.title) {
      document.title = test.title;
    } else {
      document.title = "AI ミニテストメーカー (Mini Test Maker)";
    }
  }, [test?.title]);

  // 初回マウント時に LocalStorage から即時ロードし、IndexedDB の大容量データがあれば非同期で補完
  useEffect(() => {
    let isCancelled = false;

    // 1. まずは localStorage から即時ロード (画面のちらつき防止)
    const loadedPool = loadQuestionPool();
    const loadedTest = loadCurrentTest();
    const loadedSettings = loadAppSettings();

    // 既存セクションタイトルの「大問1 2次関数」等を「大問１　2次関数」に自動正規化
    if (loadedTest && loadedTest.sections) {
      loadedTest.sections = loadedTest.sections.map(s => ({
        ...s,
        title: s.title
          ? s.title.replace(/^大問([0-9０-９]+)[ ]+/g, (_, n) => {
              const fullN = n.replace(/[0-9]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) + 0xFEE0));
              return `大問${fullN}　`;
            })
          : s.title
      }));
    }

    setPool(loadedPool);
    setTest(loadedTest);
    setSettings(loadedSettings);
    setIsLoaded(true);

    // 2. IndexedDB から最新・大容量プールとテストをロード (LocalStorage の容量制限で保存できなかったデータも復元)
    Promise.all([loadQuestionPoolAsync(), loadCurrentTestAsync()]).then(([idbPool, idbTest]) => {
      if (isCancelled) return;

      if (idbPool && idbPool.length > loadedPool.length) {
        setPool(idbPool);
      }

      if (idbTest && idbTest.sections && idbTest.sections.length > 0) {
        const normalizedSections = idbTest.sections.map(s => ({
          ...s,
          title: s.title
            ? s.title.replace(/^大問([0-9０-９]+)[ ]+/g, (_, n) => {
                const fullN = n.replace(/[0-9]/g, (d: string) => String.fromCharCode(d.charCodeAt(0) + 0xFEE0));
                return `大問${fullN}　`;
              })
            : s.title
        }));
        // 既存より詳細な情報があれば反映
        setTest(prev => (prev ? { ...prev, ...idbTest, sections: normalizedSections } : idbTest));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // pool 変更時の自動保存
  useEffect(() => {
    if (isLoaded && pool.length > 0) {
      saveQuestionPool(pool);
    }
  }, [pool, isLoaded]);

  // test 変更時の自動保存
  useEffect(() => {
    if (isLoaded && test) {
      saveCurrentTest(test);
    }
  }, [test, isLoaded]);

  // 全利用可能タグ（タグマスター + プール内の全タグ）
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>(settings.tagMaster || []);
    pool.forEach(q => (q.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, [settings.tagMaster, pool]);

  // 設定保存ハンドラー
  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveAppSettings(newSettings);
    showToast("システム設定 ＆ タグマスターを保存しました！");
  }, []);

  // テスト変更前の履歴プッシュ
  const pushHistory = useCallback((currentState: QuizTest | null) => {
    if (!currentState) return;
    setTestHistory(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentState))]);
  }, []);

  // やり直す（Undo / Ctrl+Z）
  const handleUndo = useCallback(() => {
    if (testHistory.length === 0) {
      showToast("これ以上戻せる履歴がありません");
      return;
    }
    setTestHistory(prev => {
      const nextHistory = [...prev];
      const previousState = nextHistory.pop();
      if (previousState) {
        setTest(previousState);
        showToast("直前の操作を取り消し、元に戻しました (Ctrl+Z)");
      }
      return nextHistory;
    });
  }, [testHistory]);

  // Ctrl+Z (Cmd+Z) ショートカットリスナー
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  // Step 1 プール削除リクエスト（カスタム確認モーダル表示）
  const handleRequestDeleteFromPool = useCallback((q: Question) => {
    setQuestionToDelete(q);
    setIsConfirmDeleteModalOpen(true);
  }, []);

  // Step 1 削除確定実行
  const handleConfirmDeleteFromPool = useCallback(() => {
    if (!questionToDelete) return;
    const targetQ = questionToDelete;
    setRecentlyDeletedPoolQuestion(targetQ);
    setPool(prev => prev.filter(q => q.id !== targetQ.id));
    setQuestionToDelete(null);
    showToast(`「${targetQ.topic}」をプールから削除しました`);
  }, [questionToDelete]);

  // 直前にプールから削除した問題を復元
  const handleRestorePoolQuestion = useCallback(() => {
    if (!recentlyDeletedPoolQuestion) return;
    setPool(prev => [recentlyDeletedPoolQuestion, ...prev]);
    showToast(`「${recentlyDeletedPoolQuestion.topic}」をプールに復元しました！`);
    setRecentlyDeletedPoolQuestion(null);
  }, [recentlyDeletedPoolQuestion]);

  // 現在の合計配点
  const currentTotal = useMemo(() => {
    if (!test) return 0;
    return calculateCurrentTotal(test.sections);
  }, [test]);

  /* -------------------------------------------------------------
     アクションハンドラー群
     ------------------------------------------------------------- */

  // 大問への問題追加
  const handleAddToSection = useCallback((secIdx: number, q: Question) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec) return prev;

      // すでに同じ問題が含まれているかチェック
      const exists = targetSec.questions.some(item => item.id === q.id);
      if (exists) {
        showToast("この問題はすでに大問に含まれています");
        return prev;
      }

      const updatedSections = prev.sections.map((s, idx) => {
        if (idx !== secIdx) return s;
        const newQuestions = [...s.questions, { ...q }];
        return {
          ...s,
          title: generateSectionTitleFromQuestions(idx, newQuestions),
          questions: newQuestions
        };
      });

      // 100点自動均等配分
      const balanced = recalculateTestScores(updatedSections);
      showToast(`大問${secIdx + 1} に「${q.topic}」を追加し、題名と配点を自動更新しました`);
      return { ...prev, sections: balanced };
    });
  }, [test]);

  // 全スロット自動充填（パターンB）
  const handleAutoFillSlots = useCallback(() => {
    if (!test || pool.length === 0) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;

      const newSections = prev.sections.map((sec, sIdx) => {
        // 大問の対象ジャンルまたは全体から問題を3問ずつ抽出
        const matched = pool.filter(q =>
          sIdx === 0 ? q.genre === "図形" || q.topic.includes("図形") : q.genre === "計算" || q.genre === "代数"
        );
        const candidates = matched.length >= 3 ? matched : pool;
        const selected = candidates.slice(0, 3).map(q => ({ ...q }));

        return {
          ...sec,
          title: generateSectionTitleFromQuestions(sIdx, selected),
          questions: selected
        };
      });

      const balanced = recalculateTestScores(newSections);
      showToast("プールから大問スロットを自動充填し、論点から題名を自動入力しました！");
      return { ...prev, sections: balanced };
    });
  }, [test, pool, pushHistory]);

  // 100点均等割り振りの再実行
  const handleRecalculateScores = useCallback(() => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const balanced = recalculateTestScores(prev.sections);
      showToast("全設問を100点に自動均等配分しました");
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // ワンタップ・スワップ（差し替え）
  const handleSwapQuestion = useCallback((secIdx: number, qIdx: number) => {
    if (!test || pool.length === 0) return;
    const targetQ = test.sections[secIdx]?.questions[qIdx];
    if (!targetQ) return;

    // 同一ジャンルまたは未採用の問題から候補を探す
    const currentIds = new Set<string>();
    test.sections.forEach(s => s.questions.forEach(q => currentIds.add(q.id)));

    let candidates = pool.filter(q => !currentIds.has(q.id) && q.genre === targetQ.genre);
    if (candidates.length === 0) {
      candidates = pool.filter(q => !currentIds.has(q.id));
    }
    if (candidates.length === 0) {
      candidates = pool.filter(q => q.id !== targetQ.id);
    }

    if (candidates.length === 0) {
      showToast("差し替え可能な別問題がプールにありません");
      return;
    }

    const nextQ = candidates[Math.floor(Math.random() * candidates.length)];
    pushHistory(test);

    setTest(prev => {
      if (!prev) return null;
      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = [...s.questions];
        newQs[qIdx] = { ...nextQ, defaultPoints: targetQ.defaultPoints };
        return {
          ...s,
          title: generateSectionTitleFromQuestions(sI, newQs),
          questions: newQs
        };
      });
      showToast(`第${qIdx + 1}問を差し替え、大問${secIdx + 1}の題名を更新しました！`);
      return { ...prev, sections: updated };
    });
  }, [test, pool, pushHistory]);

  // スロット・プレビューからの問題削除（配点即時再計算 & 題名更新）
  const handleDeleteQuestion = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = s.questions.filter((_, qI) => qI !== qIdx);
        return {
          ...s,
          title: generateSectionTitleFromQuestions(sI, newQs),
          questions: newQs
        };
      });

      // 削除後の残問数で100点に自動均等配分
      const balanced = recalculateTestScores(updated);
      showToast("問題を削除し、題名と配点を自動更新しました（Ctrl+Zで復元可）");
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // 解答欄レイアウト形式のワンクリック切替 (same-line ⇄ inline ⇄ stacked)
  const handleToggleAnswerLayout = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetQ = prev.sections[secIdx]?.questions[qIdx];
      if (!targetQ) return prev;

      const subLabels = extractSubQuestionLabels(targetQ.questionText, targetQ.answer, targetQ.answerLabels);
      const isShort = targetQ.questionText.length <= 42 && subLabels.length <= 1;

      let nextLayout: "inline" | "stacked" | "same-line";
      if (isShort) {
        if (targetQ.answerLayout === "same-line") {
          nextLayout = "inline";
        } else if (targetQ.answerLayout === "inline") {
          nextLayout = "stacked";
        } else if (targetQ.answerLayout === "stacked") {
          nextLayout = "same-line";
        } else {
          // auto 状態の短問: デフォルトが同一行のため、次は横並び下部へ
          nextLayout = "inline";
        }
      } else {
        const currentLayout = resolveAnswerLayout(targetQ.answerLayout, targetQ.questionText, targetQ.answer, subLabels);
        nextLayout = currentLayout === "inline" ? "stacked" : "inline";
      }

      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = s.questions.map((q, qI) => {
          if (qI !== qIdx) return q;
          return { ...q, answerLayout: nextLayout };
        });
        return { ...s, questions: newQs };
      });

      // 同時に問題プール側にも上書き反映（プール側の同じ問題も次回から同じレイアウトで使えるようにする）
      setPool(prevPool =>
        prevPool.map(pQ => (pQ.id === targetQ.id ? { ...pQ, answerLayout: nextLayout } : pQ))
      );

      const labelText =
        nextLayout === "same-line"
          ? "同一行 (単語・短問用)"
          : nextLayout === "stacked"
          ? "各問1行 (英文・記述用)"
          : "横並び (下部)";
      showToast(`第${qIdx + 1}問の解答欄を「${labelText}」に切り替えました！`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // 空スロット追加
  const handleAddEmptySlot = useCallback((secIdx: number) => {
    if (!test || pool.length === 0) return;
    const currentIds = new Set<string>();
    test.sections.forEach(s => s.questions.forEach(q => currentIds.add(q.id)));
    const unused = pool.find(q => !currentIds.has(q.id)) || pool[0];

    handleAddToSection(secIdx, unused);
  }, [test, pool, handleAddToSection]);

  // 配点個別更新
  const handleUpdateScore = useCallback((secIdx: number, qIdx: number, points: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = [...s.questions];
        if (newQs[qIdx]) {
          newQs[qIdx] = { ...newQs[qIdx], defaultPoints: points };
        }
        return { ...s, questions: newQs };
      });
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // タイトル更新
  const handleUpdateTitle = useCallback((newTitle: string) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => (prev ? { ...prev, title: newTitle } : null));
  }, [test, pushHistory]);

  // ★ 大問タイトルの更新 ★
  const handleUpdateSectionTitle = useCallback((secIdx: number, newTitle: string) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, title: newTitle } : s));
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 論点から大問タイトルを自動再入力 ★
  const handleAutoGenerateSectionTitle = useCallback((secIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec) return prev;
      const autoTitle = generateSectionTitleFromQuestions(secIdx, targetSec.questions);
      const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, title: autoTitle } : s));
      showToast(`大問${secIdx + 1} の題名を「${autoTitle}」に自動入力しました`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 新しい大問セクションの追加（空の大問として作成） ★
  const handleAddSection = useCallback(() => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const nextNum = prev.sections.length + 1;
      const newSecId = `sec-${Date.now()}`;

      const newSection: TestSection = {
        id: newSecId,
        title: generateSectionTitleFromQuestions(prev.sections.length, []),
        targetPoints: 20,
        questions: []
      };

      const updatedSections = [...prev.sections, newSection];
      showToast(`「大問${nextNum}」を追加しました。左の問題プールから問題を追加してください`);
      return { ...prev, sections: updatedSections };
    });
  }, [test, pushHistory]);

  // ★ 新しい大問を作成して指定された問題を1問目として追加（STEP 1の「+新大問」ボタンから呼び出し） ★
  const handleCreateSectionWithQuestion = useCallback((q: Question) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const nextNum = prev.sections.length + 1;
      const newSecId = `sec-${Date.now()}`;
      const initialQs = [{ ...q }];

      const newSection: TestSection = {
        id: newSecId,
        title: generateSectionTitleFromQuestions(prev.sections.length, initialQs),
        targetPoints: 20,
        questions: initialQs
      };

      const updatedSections = [...prev.sections, newSection];
      const balanced = recalculateTestScores(updatedSections);
      showToast(`「大問${nextNum}」を新設し、「${q.topic}」を追加しました！`);
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // ★ 大問の所属ページ番号を変更 ★
  const handleUpdateSectionPage = useCallback((secIdx: number, page: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const updatedSections = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, page } : s));
      showToast(`大問${secIdx + 1} を第${page}ページに設定しました`);
      return { ...prev, sections: updatedSections };
    });
  }, [test, pushHistory]);

  // ★ 大問の列レイアウト（1列 ⇄ 2列グリッド）を切替 ★
  const handleToggleSectionLayout = useCallback((secIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const updatedSections = prev.sections.map((s, idx) => {
        if (idx !== secIdx) return s;
        // 現在のレイアウト判定: 2col なら 1col に、それ以外なら 2col に
        const nextLayout: "1col" | "2col" = s.layout === "2col" ? "1col" : "2col";
        return { ...s, layout: nextLayout };
      });
      const nextMode = updatedSections[secIdx].layout === "2col" ? "2列配置 (単語・短問用)" : "1列配置 (標準)";
      showToast(`大問${secIdx + 1} のレイアウトを「${nextMode}」に切り替えました！`);
      return { ...prev, sections: updatedSections };
    });
  }, [test, pushHistory]);

  // ★ 新しいページ用の空大問を追加 ★
  const handleAddNewPageSection = useCallback(() => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const nextNum = prev.sections.length + 1;
      const newSecId = `sec-${Date.now()}`;
      const currentMaxPage = getMaxPageNumber(prev.sections);
      const targetPage = currentMaxPage + 1;

      const newSection: TestSection = {
        id: newSecId,
        title: generateSectionTitleFromQuestions(prev.sections.length, []),
        targetPoints: 20,
        questions: [],
        page: targetPage
      };

      const updatedSections = [...prev.sections, newSection];
      showToast(`第${targetPage}ページ用の「大問${nextNum}」を追加しました！`);
      return { ...prev, sections: updatedSections };
    });
  }, [test, pushHistory]);

  // ★ 大問セクション削除（window.confirm排除・大問1件時は全問題クリア） ★
  const handleDeleteSection = useCallback((secIdx: number) => {
    if (!test) return;
    pushHistory(test);
    const targetTitle = test.sections[secIdx]?.title || `大問${secIdx + 1}`;

    setTest(prev => {
      if (!prev) return null;
      if (prev.sections.length > 1) {
        // 大問が複数ある場合は大問セクションごと削除
        const updatedSections = prev.sections.filter((_, idx) => idx !== secIdx);
        const balanced = recalculateTestScores(updatedSections);
        showToast(`「${targetTitle}」を削除し、残りの設問で100点に再配分しました（Ctrl+Zで復元可）`);
        return { ...prev, sections: balanced };
      } else {
        // 大問が1件のみの場合は大問内の全問題をクリア
        const updatedSections = prev.sections.map((s, idx) =>
          idx === secIdx ? { ...s, questions: [] } : s
        );
        showToast(`「${targetTitle}」の問題をすべて削除しました（Ctrl+Zで復元可）`);
        return { ...prev, sections: updatedSections };
      }
    });
  }, [test, pushHistory]);

  // ★ 下の大問とマージ（結合）: 元データは壊さず、テスト作成時のみ統合 ★
  const handleMergeWithNextSection = useCallback((secIdx: number) => {
    if (!test) return;
    if (secIdx >= test.sections.length - 1) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const currentSec = prev.sections[secIdx];
      const nextSec = prev.sections[secIdx + 1];
      if (!currentSec || !nextSec) return prev;

      // 次の大問の設問にマージ元タイトルを付与
      const nextQuestionsWithMeta = nextSec.questions.map(q => ({
        ...q,
        mergedFromSectionTitle: q.mergedFromSectionTitle || nextSec.title,
      }));

      const mergedQuestions = [...currentSec.questions, ...nextQuestionsWithMeta];
      const mergedTitles = [
        ...(currentSec.mergedSectionTitles || [currentSec.title]),
        nextSec.title
      ];

      const newTitle = currentSec.title.includes("＆")
        ? currentSec.title
        : `${currentSec.title} ＆ ${nextSec.title.replace(/^大問\d+[\s:：]*/, "")}`;

      const mergedSec: TestSection = {
        ...currentSec,
        title: newTitle,
        questions: mergedQuestions,
        targetPoints: currentSec.targetPoints + nextSec.targetPoints,
        mergedSectionTitles: mergedTitles,
      };

      const updated = prev.sections
        .filter((_, idx) => idx !== secIdx + 1)
        .map((s, idx) => (idx === secIdx ? mergedSec : s));

      const balanced = recalculateTestScores(updated);
      showToast(`大問${secIdx + 1} と 大問${secIdx + 2} を1つの大問に統合しました！（Ctrl+Zで復元可）`);
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // ★ マージされた大問を元の各大問に復元・分割 ★
  const handleUnmergeSection = useCallback((secIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec || !targetSec.mergedSectionTitles || targetSec.mergedSectionTitles.length <= 1) return prev;

      const baseTitle = targetSec.mergedSectionTitles[0];
      const baseQuestions = targetSec.questions.filter(q => !q.mergedFromSectionTitle || q.mergedFromSectionTitle === baseTitle);

      const otherGroups = new Map<string, Question[]>();
      targetSec.questions.forEach(q => {
        if (q.mergedFromSectionTitle && q.mergedFromSectionTitle !== baseTitle) {
          const list = otherGroups.get(q.mergedFromSectionTitle) || [];
          list.push({ ...q, mergedFromSectionTitle: undefined });
          otherGroups.set(q.mergedFromSectionTitle, list);
        }
      });

      const newSections: TestSection[] = [
        {
          ...targetSec,
          title: baseTitle,
          questions: baseQuestions.map(q => ({ ...q, mergedFromSectionTitle: undefined })),
          mergedSectionTitles: undefined,
        }
      ];

      otherGroups.forEach((qs, title) => {
        newSections.push({
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: title,
          targetPoints: 20,
          questions: qs,
          page: targetSec.page,
        });
      });

      const updatedSections: TestSection[] = [];
      prev.sections.forEach((s, idx) => {
        if (idx === secIdx) {
          updatedSections.push(...newSections);
        } else {
          updatedSections.push(s);
        }
      });

      const balanced = recalculateTestScores(updatedSections);
      showToast(`大問を元の ${newSections.length} つの大問に復元・分離しました！`);
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // ★ 任意の問題の前で大問を新規分割 ★
  const handleSplitSectionAt = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec || qIdx <= 0 || qIdx >= targetSec.questions.length) return prev;

      const firstPartQuestions = targetSec.questions.slice(0, qIdx);
      const secondPartQuestions = targetSec.questions.slice(qIdx);

      const sec1: TestSection = {
        ...targetSec,
        questions: firstPartQuestions,
        title: generateSectionTitleFromQuestions(secIdx, firstPartQuestions),
      };

      const sec2: TestSection = {
        id: `sec-${Date.now()}`,
        title: generateSectionTitleFromQuestions(secIdx + 1, secondPartQuestions),
        targetPoints: 20,
        questions: secondPartQuestions,
        page: targetSec.page,
      };

      const updatedSections: TestSection[] = [];
      prev.sections.forEach((s, idx) => {
        if (idx === secIdx) {
          updatedSections.push(sec1, sec2);
        } else {
          updatedSections.push(s);
        }
      });

      const balanced = recalculateTestScores(updatedSections);
      showToast(`第${qIdx + 1}問から先を新しい大問として切り離しました！`);
      return { ...prev, sections: balanced };
    });
  }, [test, pushHistory]);

  // ★ 小問の順序移動（同一大問内の上下移動 ＆ 大問をまたぐ移動） ★
  const handleMoveQuestion = useCallback((secIdx: number, qIdx: number, direction: "up" | "down") => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec) return prev;
      const targetQ = targetSec.questions[qIdx];
      if (!targetQ) return prev;

      // 1. 同一大問内での移動
      if (direction === "up" && qIdx > 0) {
        const newQs = [...targetSec.questions];
        const temp = newQs[qIdx - 1];
        newQs[qIdx - 1] = targetQ;
        newQs[qIdx] = temp;
        const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, questions: newQs } : s));
        return { ...prev, sections: updated };
      }
      if (direction === "down" && qIdx < targetSec.questions.length - 1) {
        const newQs = [...targetSec.questions];
        const temp = newQs[qIdx + 1];
        newQs[qIdx + 1] = targetQ;
        newQs[qIdx] = temp;
        const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, questions: newQs } : s));
        return { ...prev, sections: updated };
      }

      // 2. 先頭で up された場合 -> 前の大問の末尾へ移動
      if (direction === "up" && qIdx === 0 && secIdx > 0) {
        const prevSec = prev.sections[secIdx - 1];
        const updatedCurrentQs = targetSec.questions.filter((_, i) => i !== 0);
        const updatedPrevQs = [...prevSec.questions, targetQ];

        const updated = prev.sections.map((s, idx) => {
          if (idx === secIdx - 1) return { ...s, questions: updatedPrevQs };
          if (idx === secIdx) return { ...s, questions: updatedCurrentQs };
          return s;
        });
        showToast(`問題を前の一覧（大問${secIdx}）の末尾へ移動しました`);
        return { ...prev, sections: updated };
      }

      // 3. 末尾で down された場合 -> 次の大問の先頭へ移動
      if (direction === "down" && qIdx === targetSec.questions.length - 1 && secIdx < prev.sections.length - 1) {
        const nextSec = prev.sections[secIdx + 1];
        const updatedCurrentQs = targetSec.questions.filter((_, i) => i !== qIdx);
        const updatedNextQs = [targetQ, ...nextSec.questions];

        const updated = prev.sections.map((s, idx) => {
          if (idx === secIdx) return { ...s, questions: updatedCurrentQs };
          if (idx === secIdx + 1) return { ...s, questions: updatedNextQs };
          return s;
        });
        showToast(`問題を次の一覧（大問${secIdx + 2}）の先頭へ移動しました`);
        return { ...prev, sections: updated };
      }

      return prev;
    });
  }, [test, pushHistory]);

  // ★ 解答欄の長さを微調整（±20px） ★
  const handleAdjustAnswerWidth = useCallback((secIdx: number, qIdx: number, delta: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetQ = prev.sections[secIdx]?.questions[qIdx];
      if (!targetQ) return prev;

      const currentWidth = targetQ.customLineWidth || 130;
      const nextWidth = Math.max(60, Math.min(360, currentWidth + delta));

      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = s.questions.map((q, qI) => (qI === qIdx ? { ...q, customLineWidth: nextWidth } : q));
        return { ...s, questions: newQs };
      });
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 解答欄の横位置切替（right ⇄ left ⇄ center） ★
  const handleToggleAnswerAlign = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetQ = prev.sections[secIdx]?.questions[qIdx];
      if (!targetQ) return prev;

      const currentAlign = targetQ.answerAlign || "right";
      const nextAlign: "right" | "left" | "center" =
        currentAlign === "right" ? "left" : currentAlign === "left" ? "center" : "right";

      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = s.questions.map((q, qI) => (qI === qIdx ? { ...q, answerAlign: nextAlign } : q));
        return { ...s, questions: newQs };
      });
      const label = nextAlign === "left" ? "左寄せ" : nextAlign === "center" ? "中央寄せ" : "右寄せ";
      showToast(`解答欄の位置を「${label}」に切り替えました！`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 大問内の小問（Question）同士をマージして連番化（非破壊） ★
  const handleMergeQuestions = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    const currentSec = test.sections[secIdx];
    if (!currentSec || qIdx >= currentSec.questions.length - 1) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const sec = prev.sections[secIdx];
      if (!sec || qIdx >= sec.questions.length - 1) return prev;
      const q1 = sec.questions[qIdx];
      const q2 = sec.questions[qIdx + 1];
      const merged = mergeQuestions([q1, q2]);

      const newQuestions = [...sec.questions];
      newQuestions.splice(qIdx, 2, merged);

      const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, questions: newQuestions } : s));
      showToast(`問${qIdx + 1} と 問${qIdx + 2} をマージして連番化しました！（Ctrl+Zで復元可）`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ マージされた小問を元の問題たちに復元 ★
  const handleUnmergeQuestion = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const sec = prev.sections[secIdx];
      const targetQ = sec?.questions[qIdx];
      if (!sec || !targetQ || !targetQ.mergedQuestions || targetQ.mergedQuestions.length === 0) return prev;

      const originalQuestions = unmergeQuestion(targetQ);
      const newQuestions = [...sec.questions];
      newQuestions.splice(qIdx, 1, ...originalQuestions);

      const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, questions: newQuestions } : s));
      showToast(`マージを解除し、元の${originalQuestions.length}問に復元しました`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 大問内の全小問を一括マージして連番化 ★
  const handleMergeAllQuestionsInSection = useCallback((secIdx: number) => {
    if (!test) return;
    const sec = test.sections[secIdx];
    if (!sec || sec.questions.length <= 1) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetSec = prev.sections[secIdx];
      if (!targetSec || targetSec.questions.length <= 1) return prev;
      const merged = mergeQuestions(targetSec.questions);

      const updated = prev.sections.map((s, idx) => (idx === secIdx ? { ...s, questions: [merged] } : s));
      showToast(`大問${secIdx + 1}の全${targetSec.questions.length}問をマージして連番化しました！`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // ★ 小問アイテムの列数（1行あたりの単語数: 1列 ⇄ 2列グリッド）を切替 ★
  const handleToggleItemColumns = useCallback((secIdx: number, qIdx: number) => {
    if (!test) return;
    pushHistory(test);
    setTest(prev => {
      if (!prev) return null;
      const targetQ = prev.sections[secIdx]?.questions[qIdx];
      if (!targetQ) return prev;
      const nextCols: 1 | 2 = targetQ.itemColumns === 2 ? 1 : 2;
      const updated = prev.sections.map((s, sI) => {
        if (sI !== secIdx) return s;
        const newQs = s.questions.map((q, qI) => (qI === qIdx ? { ...q, itemColumns: nextCols } : q));
        return { ...s, questions: newQs };
      });
      showToast(`小問の並びを「${nextCols === 2 ? "2列並び (左右2問)" : "1列並び"}」に切り替えました！`);
      return { ...prev, sections: updated };
    });
  }, [test, pushHistory]);

  // 問題編集モーダルを開く（プールから）
  const handleOpenEditFromPool = useCallback((q: Question) => {
    setEditingQuestion(q);
    setEditTargetPosition(null);
    setIsEditModalOpen(true);
  }, []);

  // 問題編集モーダルを開く（大問スロット or プレビューから）
  const handleOpenEditFromSection = useCallback((secIdx: number, qIdx: number, q: Question) => {
    setEditingQuestion(q);
    setEditTargetPosition({ secIdx, qIdx });
    setIsEditModalOpen(true);
  }, []);

  // 新規問題作成モーダルを開く
  const handleOpenCreateModal = useCallback(() => {
    const newBlank: Question = {
      id: `custom-q-${Date.now()}`,
      grade: settings.defaultGrade || "中2",
      textbook: settings.defaultTextbook || "",
      genre: "数学",
      topic: "新単元",
      subTopic: "基本問題",
      tags: ["新規"],
      difficulty: 2,
      estimatedSeconds: 60,
      questionText: "問題文をここに入力してください。",
      answer: "解答を入力",
      explanation: "",
      defaultPoints: 10
    };
    setEditingQuestion(newBlank);
    setEditTargetPosition(null);
    setIsEditModalOpen(true);
  }, [settings]);

  // 類題作成用AIプロンプトモーダルを開く
  const handleOpenSimilarPromptModal = useCallback((q: Question) => {
    setSimilarPromptQuestion(q);
    setIsSimilarPromptModalOpen(true);
  }, []);

  // 編集内容の保存
  const handleSaveEditedQuestion = useCallback((updated: Question) => {
    // テスト側スロットの編集である場合
    if (editTargetPosition && test) {
      pushHistory(test);
      setTest(prev => {
        if (!prev) return null;
        const updatedSections = prev.sections.map((s, sI) => {
          if (sI !== editTargetPosition.secIdx) return s;
          const newQs = s.questions.map((q, qI) => {
            if (qI !== editTargetPosition.qIdx) return q;
            return { ...updated, defaultPoints: q.defaultPoints };
          });
          return { ...s, questions: newQs };
        });
        return { ...prev, sections: updatedSections };
      });
      // テスト側での編集時は、プール側のマスターは間引き・破壊せずそのまま温存
      showToast("テスト内の問題を更新しました");
      return;
    }

    // プール側からの直接編集（または新規作成）の場合
    setPool(prev => {
      const exists = prev.some(q => q.id === updated.id);
      if (exists) {
        return prev.map(q => (q.id === updated.id ? updated : q));
      } else {
        return [updated, ...prev];
      }
    });

    // テスト内に同一IDの問題があれば同期反映
    if (test) {
      setTest(prev => {
        if (!prev) return null;
        const updatedSections = prev.sections.map(s => ({
          ...s,
          questions: s.questions.map(q => (q.id === updated.id ? { ...updated, defaultPoints: q.defaultPoints } : q))
        }));
        return { ...prev, sections: updatedSections };
      });
    }

    showToast("問題バンクの内容を保存・反映しました");
  }, [editTargetPosition, test, pushHistory]);

  // ★ 枝問（小問）編集モーダルを開く（STEP 2 または STEP 3 から直接起動） ★
  const handleOpenSubItemEditor = useCallback((secIdx: number, qIdx: number, q: Question) => {
    setSubItemModalQuestion(q);
    setSubItemModalPosition({ secIdx, qIdx });
    setIsSubItemModalOpen(true);
  }, []);

  // ★ 枝問（マスターデータ）編集モーダルを開く（STEP 1 プールから直接起動） ★
  const handleOpenSubItemEditorFromPool = useCallback((q: Question) => {
    setSubItemModalQuestion(q);
    setSubItemModalPosition(null);
    setIsSubItemModalOpen(true);
  }, []);

  // ★ 枝問（小問）編集の保存反映 ★
  const handleSaveSubItemQuestion = useCallback((updated: Question, targetPosition?: { secIdx: number; qIdx: number } | null) => {
    const isMasterEdit = !targetPosition || targetPosition.secIdx < 0;

    if (test) {
      pushHistory(test);
      // テスト側の該当スロットまたは全一致スロットを更新
      setTest(prev => {
        if (!prev) return null;
        if (targetPosition && targetPosition.secIdx >= 0) {
          const updatedSections = prev.sections.map((s, sI) => {
            if (sI !== targetPosition.secIdx) return s;
            const newQs = s.questions.map((q, qI) => {
              if (qI !== targetPosition.qIdx) return q;
              return { ...updated, defaultPoints: q.defaultPoints };
            });
            return { ...s, questions: newQs };
          });
          return { ...prev, sections: updatedSections };
        } else {
          // マスター編集時: テスト内にこの問題が使われていれば最新テキストに同期
          const updatedSections = prev.sections.map(s => ({
            ...s,
            questions: s.questions.map(q => (q.id === updated.id ? { ...updated, defaultPoints: q.defaultPoints } : q))
          }));
          return { ...prev, sections: updatedSections };
        }
      });
    }

    // ★ プール側から開いたマスター編集時のみプールを更新。テスト内の枝問選択・間引きではプールは一切触らない！ ★
    if (isMasterEdit) {
      setPool(prev => prev.map(q => (q.id === updated.id ? updated : q)));
      showToast("問題バンクの枝問マスターデータを更新しました！");
    } else {
      showToast("テストの出題枝問を更新しました（元問題はそのまま保持）");
    }
  }, [test, pushHistory]);

  // TSVエクスポート（スプレッドシート貼り付け用）
  const handleExportTsv = useCallback(() => {
    const tsv = exportQuestionsToTsv(pool);
    navigator.clipboard.writeText(tsv);
    showToast("スプレッドシート貼り付け用TSVをクリップボードにコピーしました！");
  }, [pool]);

  // Mini-JSONエクスポート
  const handleExportJson = useCallback(() => {
    const jsonStr = exportQuestionsToMiniJson(pool);
    navigator.clipboard.writeText(jsonStr);
    showToast("Mini-JSONをクリップボードにコピーしました！");
  }, [pool]);

  // 一括取込成功時（重複チェック＆マージ対応）
  const handleImportSuccess = useCallback((imported: Question[], skipDuplicates: boolean = true) => {
    if (!skipDuplicates) {
      setPool(prev => [...imported, ...prev]);
      showToast(`${imported.length}問 を問題プールに一括追加しました！`);
      return;
    }

    const normalize = (str?: string) => (str || "").replace(/\s+/g, "").trim().toLowerCase();

    setPool(prev => {
      let addedCount = 0;
      let mergedCount = 0;
      const updatedPool = [...prev];

      imported.forEach(newQ => {
        const normNewQ = normalize(newQ.questionText);
        const normNewAns = normalize(newQ.answer);

        // 既存プール内から重複する問題を検索（問題文一致 ＆ 解答一致または未設定）
        const existingIdx = updatedPool.findIndex(existing => {
          const normExQ = normalize(existing.questionText);
          const normExAns = normalize(existing.answer);
          return normExQ === normNewQ && (normNewAns === normExAns || !normNewAns || !normExAns);
        });

        if (existingIdx !== -1) {
          // 重複あり：既存問題へ新しいタグや教科書名等をマージ補完
          const existing = updatedPool[existingIdx];
          const combinedTags = Array.from(new Set([...existing.tags, ...(newQ.tags || [])]));
          const mergedTextbook = existing.textbook || newQ.textbook;
          const mergedGrade = existing.grade || newQ.grade;
          const mergedExplanation = existing.explanation || newQ.explanation;
          const mergedSvg = existing.figureSvg || newQ.figureSvg;

          updatedPool[existingIdx] = {
            ...existing,
            tags: combinedTags,
            textbook: mergedTextbook,
            grade: mergedGrade,
            explanation: mergedExplanation,
            figureSvg: mergedSvg,
            originalQuestionText: newQ.originalQuestionText || existing.originalQuestionText,
            originalAnswer: newQ.originalAnswer || existing.originalAnswer,
            originalExplanation: newQ.originalExplanation || existing.originalExplanation,
            selectedSubItemIndices: newQ.selectedSubItemIndices !== undefined ? newQ.selectedSubItemIndices : existing.selectedSubItemIndices,
            isSubItemDisabled: newQ.isSubItemDisabled !== undefined ? newQ.isSubItemDisabled : existing.isSubItemDisabled,
            answerLabels: newQ.answerLabels || existing.answerLabels
          };
          mergedCount++;
        } else {
          // 新規問題として先頭に追加
          updatedPool.unshift(newQ);
          addedCount++;
        }
      });

      if (mergedCount > 0) {
        showToast(`${addedCount}問を新規追加、${mergedCount}問の既存問題にタグ等をマージしました！`);
      } else {
        showToast(`${addedCount}問 を問題プールに一括追加しました！`);
      }

      return updatedPool;
    });
  }, []);

  // 印刷・PDF出力ハンドラー（ブラウザの初期保存ファイル名をテスト名に設定）
  const handlePrint = useCallback(() => {
    if (test?.title) {
      document.title = test.title;
    }
    window.print();
  }, [test?.title]);

  // ローカル保存済みテストの呼び出し
  const handleLoadTest = useCallback((newTest: QuizTest) => {
    if (test) pushHistory(test);
    setTest(newTest);
    saveCurrentTest(newTest);
    showToast(`テスト「${newTest.title}」を呼び出しました`);
  }, [test, pushHistory]);

  // ローカル保存済み問題バンクの読み込み
  const handleLoadPool = useCallback((newQuestions: Question[], mode: "replace" | "append", bankName?: string) => {
    if (mode === "replace") {
      setPool(newQuestions);
      saveQuestionPool(newQuestions);
      showToast(`問題バンク「${bankName || "問題"}」(${newQuestions.length}問) に置き換えました`);
    } else {
      const existingIds = new Set(pool.map(q => q.id));
      const toAdd = newQuestions.filter(q => !existingIds.has(q.id));
      const merged = [...pool, ...toAdd];
      setPool(merged);
      saveQuestionPool(merged);
      showToast(`${toAdd.length}問をプールに追加しました (全${merged.length}問)`);
    }
  }, [pool]);

  if (!isLoaded || !test) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500 text-sm">
        データを読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* グローバルヘッダー */}
      <Header
        sheetMode={sheetMode}
        setSheetMode={setSheetMode}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportTsv={handleExportTsv}
        onExportJson={handleExportJson}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onUndo={handleUndo}
        canUndo={testHistory.length > 0}
        onPrint={handlePrint}
      />

      {/* 3カラムメインワークスペース */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden print:block print:overflow-visible print:h-auto">
        {/* STEP 1: 問題プール（幅 4/12） */}
        <div className="no-print col-span-4 h-full overflow-hidden">
          <Step1Pool
            pool={pool}
            sections={test.sections}
            onAddToSection={handleAddToSection}
            onEditQuestion={handleOpenEditFromPool}
            onOpenSubItemEditor={handleOpenSubItemEditorFromPool}
            onDeleteQuestionFromPool={handleRequestDeleteFromPool}
            onOpenCreateModal={handleOpenCreateModal}
            onGenerateSimilarPrompt={handleOpenSimilarPromptModal}
            onCreateSectionAndAdd={handleCreateSectionWithQuestion}
            onAddEmptySection={handleAddSection}
          />
        </div>

        {/* STEP 2: テスト編成（幅 3/12） */}
        <div className="no-print col-span-3 h-full overflow-hidden">
          <Step2Builder
            test={test}
            currentTotal={currentTotal}
            onAutoFillSlots={handleAutoFillSlots}
            onRecalculateScores={handleRecalculateScores}
            onSwapQuestion={handleSwapQuestion}
            onEditQuestion={handleOpenEditFromSection}
            onOpenSubItemEditor={handleOpenSubItemEditor}
            onDeleteQuestion={handleDeleteQuestion}
            onAddEmptySlot={handleAddEmptySlot}
            onUpdateScore={handleUpdateScore}
            onUpdateSectionTitle={handleUpdateSectionTitle}
            onAutoGenerateSectionTitle={handleAutoGenerateSectionTitle}
            onAddSection={handleAddSection}
            onDeleteSection={handleDeleteSection}
            onMergeWithNextSection={handleMergeWithNextSection}
            onUnmergeSection={handleUnmergeSection}
            onMergeQuestions={handleMergeQuestions}
            onUnmergeQuestion={handleUnmergeQuestion}
            onMergeAllQuestionsInSection={handleMergeAllQuestionsInSection}
            onSplitSectionAt={handleSplitSectionAt}
            onMoveQuestion={handleMoveQuestion}
            onUpdateSectionPage={handleUpdateSectionPage}
            onAddNewPageSection={handleAddNewPageSection}
            onUndo={handleUndo}
            canUndo={testHistory.length > 0}
          />
        </div>

        {/* STEP 3: A4完成プレビュー（幅 5/12、印刷時は全幅） */}
        <div className="col-span-5 print:col-span-12 h-full overflow-hidden print:h-auto print:overflow-visible print:block">
          <Step3Preview
            test={test}
            sheetMode={sheetMode}
            onUpdateTitle={handleUpdateTitle}
            onUpdateSectionTitle={handleUpdateSectionTitle}
            onAutoGenerateSectionTitle={handleAutoGenerateSectionTitle}
            onSwapQuestion={handleSwapQuestion}
            onEditQuestion={handleOpenEditFromSection}
            onOpenSubItemEditor={handleOpenSubItemEditor}
            onDeleteQuestion={handleDeleteQuestion}
            onToggleAnswerLayout={handleToggleAnswerLayout}
            onMergeWithNextSection={handleMergeWithNextSection}
            onUnmergeSection={handleUnmergeSection}
            onMergeQuestions={handleMergeQuestions}
            onUnmergeQuestion={handleUnmergeQuestion}
            onSplitSectionAt={handleSplitSectionAt}
            onMoveQuestion={handleMoveQuestion}
            onAdjustAnswerWidth={handleAdjustAnswerWidth}
            onToggleAnswerAlign={handleToggleAnswerAlign}
            onGenerateSimilarPrompt={handleOpenSimilarPromptModal}
            onUpdateSectionPage={handleUpdateSectionPage}
            onAddNewPageSection={handleAddNewPageSection}
            onToggleSectionLayout={handleToggleSectionLayout}
            onToggleItemColumns={handleToggleItemColumns}
            onUndo={handleUndo}
            canUndo={testHistory.length > 0}
          />
        </div>
      </main>

      {/* 編集モーダル */}
      <EditQuestionModal
        isOpen={isEditModalOpen}
        question={editingQuestion}
        availableTags={allAvailableTags}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedQuestion}
        onOpenSubItemEditor={(q) => handleOpenSubItemEditor(-1, -1, q)}
      />

      {/* ★ 大問内の枝問（小問）専用編集モーダル（STEP 1 / STEP 2 / STEP 3から起動） ★ */}
      <SubItemEditorModal
        isOpen={isSubItemModalOpen}
        question={subItemModalQuestion}
        targetPosition={subItemModalPosition}
        mode={subItemModalPosition && subItemModalPosition.secIdx >= 0 ? "selection" : "master"}
        onClose={() => setIsSubItemModalOpen(false)}
        onSave={handleSaveSubItemQuestion}
      />

      {/* インポートモーダル（スプレッドシートTSV / Mini-JSON） */}
      <ImportExportModal
        isOpen={isImportModalOpen}
        defaultGrade={settings.defaultGrade}
        defaultTextbook={settings.defaultTextbook}
        availableTags={allAvailableTags}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* 設定モーダル */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        settings={settings}
        poolTags={allAvailableTags}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Step 1 問題プール削除確認モーダル */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteModalOpen}
        question={questionToDelete}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteFromPool}
      />

      {/* 類題作成AIプロンプト生成モーダル */}
      <GenerateSimilarPromptModal
        isOpen={isSimilarPromptModalOpen}
        question={similarPromptQuestion}
        onClose={() => setIsSimilarPromptModalOpen(false)}
        onCopied={() => showToast("類題作成プロンプトをコピーしました！AIに貼り付けて出力をインポートしてください")}
      />

      {/* ローカル保存・呼出（data/tests, data/pools）管理モーダル */}
      <StorageManagerModal
        isOpen={isStorageModalOpen}
        currentTest={test}
        currentPool={pool}
        onClose={() => setIsStorageModalOpen(false)}
        onLoadTest={handleLoadTest}
        onLoadPool={handleLoadPool}
      />

      {/* 通知トースト */}
      {toastMessage && (
        <div className="no-print fixed bottom-5 right-5 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-xs flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
          {recentlyDeletedPoolQuestion && (
            <button
              onClick={handleRestorePoolQuestion}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer border border-indigo-400"
            >
              元に戻す
            </button>
          )}
        </div>
      )}
    </div>
  );
}
