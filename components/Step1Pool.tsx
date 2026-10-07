"use client";

import React, { useState, useMemo } from "react";
import { Question, TestSection } from "@/types/quiz";
import { MathText } from "./MathText";
import { fuzzySearchMatch } from "@/lib/searchUtils";
import { parseSubItems } from "@/lib/subItemUtils";
import { Search, Tag, Plus, Edit3, Trash2, Eye, EyeOff, Clock, HelpCircle, Layers, Filter, BookOpen, Sparkles, Check, ListFilter, Headphones, Image as ImageIcon } from "lucide-react";

interface Step1PoolProps {
  pool: Question[];
  sections?: TestSection[];
  onAddToSection: (secIndex: number, q: Question) => void;
  onEditQuestion: (q: Question) => void;
  onDeleteQuestionFromPool: (q: Question) => void;
  onOpenCreateModal: () => void;
  onOpenSubItemEditor?: (q: Question) => void;
  onGenerateSimilarPrompt?: (q: Question) => void;
  onCreateSectionAndAdd?: (q: Question) => void;
  onAddEmptySection?: () => void;
}

export const Step1Pool: React.FC<Step1PoolProps> = ({
  pool,
  sections = [],
  onAddToSection,
  onEditQuestion,
  onDeleteQuestionFromPool,
  onOpenCreateModal,
  onOpenSubItemEditor,
  onGenerateSimilarPrompt,
  onCreateSectionAndAdd,
  onAddEmptySection
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  // 存在する全学年を集計
  const grades = useMemo(() => {
    const set = new Set<string>();
    pool.forEach(q => q.grade && set.add(q.grade));
    return ["all", ...Array.from(set).sort()];
  }, [pool]);

  // 存在する全ジャンルを集計
  const genres = useMemo(() => {
    const set = new Set<string>();
    pool.forEach(q => {
      if (selectedGrade === "all" || q.grade === selectedGrade) {
        if (q.genre) set.add(q.genre);
      }
    });
    return ["all", ...Array.from(set)];
  }, [pool, selectedGrade]);

  // 選択ジャンルに属するメイン単元（topic）を集計
  const availableTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    pool.forEach(q => {
      if (
        (selectedGrade === "all" || q.grade === selectedGrade) &&
        (selectedGenre === "all" || q.genre === selectedGenre)
      ) {
        const t = q.topic || "その他";
        counts[t] = (counts[t] || 0) + 1;
      }
    });
    return [
      { topic: "all", count: Object.values(counts).reduce((a, b) => a + b, 0) },
      ...Object.entries(counts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
    ];
  }, [pool, selectedGrade, selectedGenre]);

  // 学年・教科・単元変更時の連動
  const handleGradeChange = (gr: string) => {
    setSelectedGrade(gr);
    setSelectedGenre("all");
    setSelectedTopic("all");
    setSelectedTag(null);
  };

  const handleGenreChange = (g: string) => {
    setSelectedGenre(g);
    setSelectedTopic("all");
    setSelectedTag(null);
  };

  const handleTopicChange = (t: string) => {
    setSelectedTopic(t);
    setSelectedTag(null);
  };

  // 選択された学年・教科・メイン単元のコンテキストに合致する問題群（タグ抽出用）
  const contextQuestionsForTags = useMemo(() => {
    return pool.filter(q => {
      if (selectedGrade !== "all" && q.grade !== selectedGrade) return false;
      if (selectedGenre !== "all" && q.genre !== selectedGenre) return false;
      if (selectedTopic !== "all" && q.topic !== selectedTopic) return false;
      return true;
    });
  }, [pool, selectedGrade, selectedGenre, selectedTopic]);

  // 単元別タググルーピング
  const topicGroupedTags = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    contextQuestionsForTags.forEach(q => {
      const top = q.topic || "その他";
      if (!map[top]) map[top] = {};
      (q.tags || []).forEach(t => {
        // タグ検索クエリによる絞り込み（あいまい・表記ゆれ対応）
        if (!tagSearchQuery.trim() || fuzzySearchMatch(t, tagSearchQuery)) {
          map[top][t] = (map[top][t] || 0) + 1;
        }
      });
    });

    return Object.entries(map)
      .map(([topic, tagCounts]) => ({
        topic,
        tags: Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
      }))
      .filter(group => group.tags.length > 0);
  }, [contextQuestionsForTags, tagSearchQuery]);

  // 単一リスト形式のタグ一覧（頻出順）
  const flatSortedTags = useMemo(() => {
    const counts: Record<string, number> = {};
    contextQuestionsForTags.forEach(q => {
      (q.tags || []).forEach(t => {
        if (!tagSearchQuery.trim() || fuzzySearchMatch(t, tagSearchQuery)) {
          counts[t] = (counts[t] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [contextQuestionsForTags, tagSearchQuery]);

  // 表記ゆれ対応のフィルタリング処理
  const filteredPool = useMemo(() => {
    return pool.filter(q => {
      // 学年一致
      if (selectedGrade !== "all" && q.grade !== selectedGrade) return false;
      // ジャンル一致
      if (selectedGenre !== "all" && q.genre !== selectedGenre) return false;
      // メイン単元一致
      if (selectedTopic !== "all" && q.topic !== selectedTopic) return false;
      // タグ一致
      if (selectedTag && !(q.tags || []).includes(selectedTag)) return false;

      // 検索ワード（漢数字/算用数字・全角半角の表記ゆれを完全吸収）
      if (searchQuery.trim()) {
        const matchGrade = fuzzySearchMatch(q.grade || "", searchQuery);
        const matchTextbook = fuzzySearchMatch(q.textbook || "", searchQuery);
        const matchText = fuzzySearchMatch(q.questionText || "", searchQuery);
        const matchTopic = fuzzySearchMatch(q.topic || "", searchQuery);
        const matchSub = fuzzySearchMatch(q.subTopic || "", searchQuery);
        const matchGenre = fuzzySearchMatch(q.genre || "", searchQuery);
        const matchAns = fuzzySearchMatch(q.answer || "", searchQuery);
        const matchTag = (q.tags || []).some(t => fuzzySearchMatch(t, searchQuery));
        if (!matchGrade && !matchTextbook && !matchText && !matchTopic && !matchSub && !matchGenre && !matchAns && !matchTag) {
          return false;
        }
      }
      return true;
    });
  }, [pool, selectedGrade, selectedGenre, selectedTopic, selectedTag, searchQuery]);

  const toggleAnswer = (qId: string) => {
    setExpandedAnswers(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* カラムヘッダー（STEP 1） */}
      <div className="px-3 py-2 bg-sky-50/80 border-b border-sky-100 flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-sky-600 text-white shrink-0 shadow-2xs">
            STEP 1
          </span>
          <h2 className="text-xs font-bold text-sky-950 truncate whitespace-nowrap" title="問題プール（蓄積ストック）">
            問題プール
          </h2>
          <span className="text-[10px] font-bold text-sky-800 bg-sky-100/90 px-1.5 py-0.2 rounded-full border border-sky-200 shrink-0 whitespace-nowrap">
            {filteredPool.length === pool.length ? `${pool.length}問` : `${filteredPool.length}/${pool.length}問`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onAddEmptySection && (
            <button
              onClick={onAddEmptySection}
              className="px-2 py-1 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="新しい大問枠を追加"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>大問追加</span>
            </button>
          )}
          <button
            onClick={onOpenCreateModal}
            className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer whitespace-nowrap"
            title="新規問題を直接作成"
          >
            <Plus className="w-3 h-3" />
            <span>新規問題</span>
          </button>
        </div>
      </div>

      {/* 検索 & フィルターバー */}
      <div className="p-2.5 bg-white border-b border-slate-200 space-y-1.5">
        {/* 全体あいまい検索入力 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="キーワード検索 (例: 中2, 一次関数, 変化の割合)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50"
          />
        </div>

        {/* 学年セレクタ */}
        {grades.length > 2 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] scrollbar-thin">
            <span className="text-[9px] font-bold text-amber-600 shrink-0 mr-0.5">学年:</span>
            {grades.map(gr => (
              <button
                key={gr}
                onClick={() => handleGradeChange(gr)}
                className={`px-1.5 py-0.2 rounded border whitespace-nowrap font-medium transition ${
                  selectedGrade === gr
                    ? "bg-amber-600 text-white border-amber-600 font-bold shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {gr === "all" ? "全学年" : gr}
              </button>
            ))}
          </div>
        )}

        {/* 教科（ジャンル）タブ */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-thin">
          <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-0.5">教科:</span>
          {genres.map(g => (
            <button
              key={g}
              onClick={() => handleGenreChange(g)}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap font-medium transition ${
                selectedGenre === g
                  ? "bg-sky-600 text-white shadow-xs font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {g === "all" ? "全教科" : g}
            </button>
          ))}
        </div>

        {/* メイン単元（topic）セレクタ */}
        {availableTopics.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] scrollbar-thin">
            <span className="text-[9px] font-bold text-slate-400 shrink-0 mr-0.5 flex items-center gap-0.5">
              <BookOpen className="w-2.5 h-2.5" />
              単元:
            </span>
            {availableTopics.map(({ topic, count }) => (
              <button
                key={topic}
                onClick={() => handleTopicChange(topic)}
                className={`px-1.5 py-0.5 rounded border whitespace-nowrap transition flex items-center gap-1 ${
                  selectedTopic === topic
                    ? "bg-teal-600 text-white border-teal-600 font-bold shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{topic === "all" ? "全単元" : topic}</span>
                <span className={`text-[8px] px-1 rounded-full ${
                  selectedTopic === topic ? "bg-teal-700 text-teal-100" : "bg-slate-200 text-slate-500"
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* タグ表示エリア（教科・単元連動 ＆ タグ検索 ＆ 単元グルーピング） */}
        {flatSortedTags.length > 0 && (
          <div className="pt-1 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5 text-indigo-500" />
                  <span className="font-semibold text-slate-600">
                    {selectedTopic !== "all" ? `${selectedTopic}のタグ` : selectedGenre !== "all" ? `${selectedGenre}のタグ` : "タグ絞込"}
                  </span>
                  <span className="text-[9px] text-slate-400">({flatSortedTags.length}種)</span>
                </div>

                {/* タグ内クイック検索入力 */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="タグ検索 (例: グラフ)..."
                    value={tagSearchQuery}
                    onChange={e => setTagSearchQuery(e.target.value)}
                    className="w-28 pl-4 pr-1.5 py-0.2 text-[9px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  />
                  <Search className="w-2.5 h-2.5 text-slate-400 absolute left-1 top-1.5" />
                  {tagSearchQuery && (
                    <button
                      onClick={() => setTagSearchQuery("")}
                      className="absolute right-1 top-0.5 text-[9px] text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="text-[9px] bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.2 rounded hover:bg-rose-100 flex items-center gap-0.5"
                  >
                    選択中: #{selectedTag} ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* 単元グループ表示切替（全単元選択時） */}
                {selectedTopic === "all" && topicGroupedTags.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setGroupByTopic(prev => !prev)}
                    className={`text-[9px] px-1.5 py-0.2 rounded border transition ${
                      groupByTopic
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                    title="単元ごとにタグを整理して表示"
                  >
                    {groupByTopic ? "単元別: ON" : "単元別"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsTagsExpanded(prev => !prev)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
                >
                  {isTagsExpanded ? "▲ 1行" : "▼ 全て"}
                </button>
              </div>
            </div>

            {/* タグチップ描画（単元別グループ表示 または 単一リスト表示） */}
            {groupByTopic && selectedTopic === "all" ? (
              <div className={`space-y-1.5 ${isTagsExpanded ? "max-h-36 overflow-y-auto p-1 bg-slate-50 rounded border border-slate-200 scrollbar-thin" : "max-h-20 overflow-y-auto"}`}>
                {topicGroupedTags.map(group => (
                  <div key={group.topic} className="space-y-0.5">
                    <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                      <span>{group.topic}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.tags.map(({ tag, count }) => {
                        const active = selectedTag === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => setSelectedTag(active ? null : tag)}
                            className={`px-1.5 py-0.2 text-[9px] rounded border whitespace-nowrap transition flex items-center gap-1 ${
                              active
                                ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <span>#{tag}</span>
                            <span className={`text-[8px] px-1 rounded-full ${
                              active ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 text-slate-500"
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 通常のタグチップ一覧 */
              <div
                className={`text-[10px] ${
                  isTagsExpanded
                    ? "flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1 bg-slate-50 rounded border border-slate-200 scrollbar-thin"
                    : "flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none"
                }`}
              >
                {flatSortedTags.map(({ tag, count }) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={`px-1.5 py-0.5 text-[9px] rounded-md border whitespace-nowrap transition shrink-0 flex items-center gap-1 ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <span>#{tag}</span>
                      <span
                        className={`text-[8px] px-1 rounded-full ${
                          active ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 問題カードリスト */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredPool.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            条件に一致する問題がありません
          </div>
        ) : (
          filteredPool.map(q => {
            const isAnsOpen = expandedAnswers[q.id];
            // 追加されている大問セクションを特定
            const addedToSections = sections
              .map((sec, sIdx) => ({
                sIdx,
                title: sec.title?.replace(/[ 　].*$/, "") || `大問${sIdx + 1}`,
                isAdded: (sec.questions || []).some(sq => sq.id === q.id)
              }))
              .filter(item => item.isAdded);
            const isAdded = addedToSections.length > 0;

            const parsedSub = parseSubItems(q.originalQuestionText || q.questionText, q.originalAnswer || q.answer, q.originalExplanation || q.explanation);
            const hasSubItems = parsedSub.hasSubItems || parsedSub.items.length >= 2;

            return (
              <div
                key={q.id}
                className={`border rounded-lg p-2.5 shadow-xs transition group space-y-2 ${
                  isAdded
                    ? "bg-slate-100/80 border-slate-300 opacity-60 hover:opacity-95 text-slate-700"
                    : "bg-white border-slate-200 hover:border-sky-300 text-slate-900"
                }`}
              >
                {/* ヘッダーメタ情報 */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isAdded && (
                      <span
                        className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-0.5 text-[9px] shrink-0"
                        title={addedToSections.map(s => s.title).join("・") + " に追加済み"}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        <span>追加済 ({addedToSections.map(s => s.title).join("・")})</span>
                      </span>
                    )}
                    {q.grade && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                        {q.grade}
                      </span>
                    )}
                    {q.textbook && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 flex items-center gap-0.5" title={`教科書: ${q.textbook}`}>
                        <BookOpen className="w-2.5 h-2.5 text-indigo-500" />
                        {q.textbook}
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 font-bold text-slate-700">
                      {q.genre}
                    </span>
                    <span className="font-semibold text-slate-800">{q.topic}</span>
                    {q.subTopic && (
                      <span className="text-slate-500 text-[9px] bg-slate-50 border border-slate-200 px-1 py-0.2 rounded">
                        {q.subTopic}
                      </span>
                    )}
                    {onOpenSubItemEditor && (
                      <button
                        type="button"
                        onClick={() => onOpenSubItemEditor(q)}
                        className={`px-1.5 py-0.2 rounded font-bold border flex items-center gap-0.5 text-[9px] cursor-pointer transition shrink-0 ${
                          hasSubItems
                            ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 border-slate-200"
                        }`}
                        title={hasSubItems ? "大問内の枝問（マスターデータ）を編集・修正" : "この問題を枝問形式に分割・追加"}
                      >
                        <ListFilter className="w-2.5 h-2.5" />
                        <span>{hasSubItems ? `枝問 ${parsedSub.items.length}問` : "枝問設定"}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span title={`難易度: ${q.difficulty}/3`}>
                      {"★".repeat(q.difficulty)}
                      <span className="text-slate-200">{"★".repeat(3 - q.difficulty)}</span>
                    </span>
                    <span className="flex items-center gap-0.5 text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      {q.estimatedSeconds}s
                    </span>
                  </div>
                </div>

                {/* タグ一覧 ＆ メディアバッジ */}
                <div className="flex items-center gap-1 flex-wrap">
                  {q.imageUrl ? (
                    <span className="text-[8.5px] bg-sky-50 text-sky-700 border border-sky-200 px-1 py-0.2 rounded flex items-center gap-0.5 font-sans font-medium" title="画像付き問題">
                      <ImageIcon className="w-2.5 h-2.5 text-sky-600" />
                      画像
                    </span>
                  ) : q.hasImagePlaceholder ? (
                    <span className="text-[8.5px] bg-amber-50 text-amber-800 border border-amber-300 px-1 py-0.2 rounded flex items-center gap-0.5 font-sans font-medium" title="絵を見て答える問題（画像欄）">
                      <ImageIcon className="w-2.5 h-2.5 text-amber-600" />
                      画像欄
                    </span>
                  ) : null}
                  {q.audioUrl && (
                    <span className="text-[8.5px] bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded flex items-center gap-0.5 font-sans font-medium" title="リスニング問題">
                      <Headphones className="w-2.5 h-2.5 text-purple-600" />
                      リスニング
                    </span>
                  )}
                  {q.tags && q.tags.length > 0 && (
                    <>
                      {q.tags.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                      {q.tags.length > 3 && (
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 rounded">
                          +{q.tags.length - 3}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* 問題本文 & SVG図形/画像（横並び） */}
                <div className="flex items-start justify-between gap-2 text-xs leading-relaxed font-serif">
                  <div className="flex-1">
                    <MathText text={q.questionText} />
                  </div>
                  {(q.figureSvg || q.imageUrl || q.hasImagePlaceholder) && (
                    <div className="shrink-0 bg-slate-50 border border-slate-100 rounded p-1 flex flex-col items-center justify-center gap-1">
                      {q.figureSvg && (
                        <div dangerouslySetInnerHTML={{ __html: q.figureSvg }} />
                      )}
                      {q.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={q.imageUrl}
                          alt="問題画像"
                          className="w-16 h-12 object-contain rounded bg-white"
                        />
                      )}
                      {q.hasImagePlaceholder && !q.imageUrl && (
                        <div className="w-16 h-12 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-white text-slate-400 select-none p-0.5">
                          <ImageIcon className="w-3.5 h-3.5 mb-0.5 opacity-60" />
                          <span className="text-[8.5px] font-bold">画像欄</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 解答・解説の折りたたみ */}
                {isAnsOpen && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2 text-[11px] space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1">
                      <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded">
                        正解
                      </span>
                      <MathText text={q.answer} />
                    </div>
                    {q.explanation && (
                      <div className="text-slate-600 text-[10px] pl-1 border-l-2 border-emerald-300 leading-normal">
                        <MathText text={q.explanation} />
                      </div>
                    )}
                  </div>
                )}

                {/* フッターアクションバー */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                  <button
                    onClick={() => toggleAnswer(q.id)}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[10px]"
                  >
                    {isAnsOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isAnsOpen ? "解答を隠す" : "解答を確認"}
                  </button>

                  <div className="flex items-center gap-1">
                    {onGenerateSimilarPrompt && (
                      <button
                        type="button"
                        onClick={() => onGenerateSimilarPrompt(q)}
                        className="p-1 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition cursor-pointer"
                        title="この問題の類題プロンプトを作成"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                    )}
                    {onOpenSubItemEditor && (
                      <button
                        type="button"
                        onClick={() => onOpenSubItemEditor(q)}
                        className={`p-1 rounded transition cursor-pointer flex items-center gap-0.5 ${
                          hasSubItems
                            ? "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold"
                            : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                        }`}
                        title={hasSubItems ? `大問内の枝問（${parsedSub.items.length}問）を編集・追加・削除` : "枝問メニュー（分割・追加）"}
                      >
                        <ListFilter className="w-3 h-3" />
                        {hasSubItems && <span className="text-[9px] font-bold">{parsedSub.items.length}</span>}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditQuestion(q)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
                      title="この問題を編集"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteQuestionFromPool(q);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                      title="プールから削除（確認画面を開く）"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* 大問への動的追加ボタン */}
                    <div className="flex items-center gap-0.5 ml-1 flex-wrap justify-end">
                      {sections.map((sec, sIdx) => {
                        const isAddedToThis = (sec.questions || []).some(sq => sq.id === q.id);
                        if (isAddedToThis) {
                          return (
                            <span
                              key={sec.id || sIdx}
                              className="px-1.5 py-0.5 bg-slate-200/90 text-slate-400 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-0.5 cursor-not-allowed select-none"
                              title={`すでに「${sec.title || `大問${sIdx + 1}`}」に追加済みです`}
                            >
                              ✓大問{sIdx + 1}
                            </span>
                          );
                        }
                        return (
                          <button
                            key={sec.id || sIdx}
                            type="button"
                            onClick={() => onAddToSection(sIdx, q)}
                            className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold transition cursor-pointer"
                            title={`「${sec.title || `大問${sIdx + 1}`}」へ追加`}
                          >
                            +大問{sIdx + 1}
                          </button>
                        );
                      })}

                      {/* 新規大問を作成して追加するボタン */}
                      {onCreateSectionAndAdd && (
                        <button
                          type="button"
                          onClick={() => onCreateSectionAndAdd(q)}
                          className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-0.5 shadow-2xs"
                          title={`新しい大問（大問${sections.length + 1}）を作成してこの問題を追加`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>新大問</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
