"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Tag as TagIcon, X, Plus } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onChange: (newTags: string[]) => void;
  availableTags?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  availableTags = [],
  placeholder = "タグを入力してEnter...",
  maxTags,
  className = ""
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 入力文字列に応じたリコメンド候補（既に登録済みのタグは除外）
  const suggestions = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    const existingSet = new Set(tags.map(t => t.toLowerCase()));

    // 全利用可能タグからユニーク化
    const allUnique = Array.from(new Set(availableTags)).filter(
      t => Boolean(t) && !existingSet.has(t.toLowerCase())
    );

    if (!trimmed) {
      // 未入力時は上位8件の利用可能タグを提示
      return allUnique.slice(0, 8);
    }

    // 前方一致と部分一致でソート
    const startsWith = allUnique.filter(t => t.toLowerCase().startsWith(trimmed));
    const contains = allUnique.filter(
      t => !t.toLowerCase().startsWith(trimmed) && t.toLowerCase().includes(trimmed)
    );

    return [...startsWith, ...contains].slice(0, 10);
  }, [inputValue, availableTags, tags]);

  // 外側クリック検知で候補メニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // タグ追加処理
  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;

    // 重複チェック（大文字小文字無視）
    const exists = tags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setInputValue("");
      setIsOpen(false);
      return;
    }

    if (maxTags && tags.length >= maxTags) return;

    onChange([...tags, trimmed]);
    setInputValue("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // タグ削除処理
  const handleRemoveTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  // キーボード操作処理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 日本語IME変換中のEnterキー誤爆を防止
    if (e.nativeEvent.isComposing) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      }
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleAddTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        handleAddTag(inputValue);
      }
    } else if (e.key === "Tab" && isOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      handleAddTag(suggestions[highlightedIndex]);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      e.preventDefault();
      handleRemoveTag(tags.length - 1);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* タグ表示 & インライン入力エリア */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[38px] w-full px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 flex flex-wrap items-center gap-1.5 transition cursor-text"
      >
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 animate-in fade-in zoom-in-95 duration-100"
          >
            <TagIcon className="w-2.5 h-2.5 text-indigo-500" />
            <span>{tag}</span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleRemoveTag(idx);
              }}
              className="p-0.5 rounded-full hover:bg-indigo-200 text-indigo-500 hover:text-indigo-800 transition"
              title="削除"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        <div className="flex-1 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : "タグを追加..."}
            className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* 類似タグ候補リコメンドドロップダウン */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 flex items-center justify-between">
            <span>💡 候補タグ (Enter または クリックで追加)</span>
            {inputValue && <span className="text-indigo-600 font-normal">&quot;{inputValue}&quot; を直接追加も可</span>}
          </div>
          <div className="p-1 space-y-0.5">
            {suggestions.map((suggestion, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={suggestion}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleAddTag(suggestion)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition ${
                    isHighlighted
                      ? "bg-indigo-50 text-indigo-800 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <TagIcon className={`w-3 h-3 ${isHighlighted ? "text-indigo-600" : "text-slate-400"}`} />
                    <span>{suggestion}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Plus className="w-2.5 h-2.5" />
                    追加
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
