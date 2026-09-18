"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * テキスト中の数式を KaTeX でレンダリングするコンポーネント
 * 対応形式:
 * - $$ ... $$ (ディスプレイ数式)
 * - \( ... \) (インライン数式)
 * - $ ... $ (シングルドル・インライン数式: 外部AIの標準出力)
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = "" }) => {
  const renderedContent = useMemo(() => {
    if (!text) return "";

    // 文字列の正規化（\n のリテラル改行化、AIの引用タグ [cite: X] の除去）
    const normalized = text
      .replace(/\\n/g, "\n")
      .replace(/\[cite:\s*\d+\]/g, "")
      .trim();

    // 日本の教科書スタイル: 不等号の下の線を省略しない（\leqq, \geqq, ≦, ≧）に正規化
    const preprocessMath = (mathStr: string): string => {
      if (!mathStr) return "";
      return mathStr
        .replace(/\\leq(?![a-zA-Z])/g, "\\leqq")
        .replace(/\\le(?![a-zA-Z])/g, "\\leqq")
        .replace(/\\geq(?![a-zA-Z])/g, "\\geqq")
        .replace(/\\ge(?![a-zA-Z])/g, "\\geqq")
        .replace(/(?:<=|=<|＜＝|＝＜)/g, "\\leqq ")
        .replace(/(?:>=|=>|＞＝|＝＞)/g, "\\geqq ")
        .replace(/≦/g, "\\leqq ")
        .replace(/≧/g, "\\geqq ");
    };

    // $$ ... $$, \( ... \), $ ... $ を検出する正規表現
    const regex = /(\$\$[\s\S]*?\$\$|\\$$[\s\S]*?\\$$|\$[^$\n]+?\$)/g;
    const parts = normalized.split(regex);

    return parts.map((part, index) => {
      // 1. ディスプレイ数式: $$ ... $$
      if (part.startsWith("$$") && part.endsWith("$$") && part.length >= 4) {
        const math = preprocessMath(part.slice(2, -2).trim());
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // 2. インライン数式: \( ... \)
      if (part.startsWith("\\(") && part.endsWith("\\)") && part.length >= 4) {
        const math = preprocessMath(part.slice(2, -2).trim());
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // 3. インライン数式: $ ... $ (外部AIがよく出す単一ドル記号形式)
      if (part.startsWith("$") && part.endsWith("$") && part.length >= 3) {
        const math = preprocessMath(part.slice(1, -1).trim());
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={index}>{part}</span>;
        }
      }

      // 通常テキスト（改行反映 & 不等号記号の日本式Unicode正規化: ＝＜ を ≦ に）
      const cleanNormalText = part
        .replace(/(?:<=|=<|＜＝|＝＜)/g, "≦")
        .replace(/(?:>=|=>|＞＝|＝＞)/g, "≧");

      return (
        <span key={index} className="whitespace-pre-wrap">
          {cleanNormalText}
        </span>
      );
    });
  }, [text]);

  return <span className={className}>{renderedContent}</span>;
};
