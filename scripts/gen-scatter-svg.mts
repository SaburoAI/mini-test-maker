/**
 * 散布図・一次関数グラフの figureSvg 生成スクリプト
 *
 * 使い方:
 *   node scripts/gen-scatter-svg.mts <spec.json>            … 問題JSON（spec.question があれば）または SVG を標準出力
 *   node scripts/gen-scatter-svg.mts <spec.json> --svg      … SVG だけを出力（プレビュー確認用）
 *
 * spec の例: scripts/figure-specs/bath-scatter.json
 * - y.min > 0 のときは縦軸の 0〜y.min を波線で省略する（x も同様）
 * - lines は y = slope * x + intercept を描画範囲いっぱいに引く
 */
import { readFileSync } from "node:fs";
import type { Question } from "../types/quiz";

interface AxisSpec {
  min: number;
  max: number;
  step: number;     // ラベルを付ける間隔
  minor?: number;   // 方眼の細線の間隔（省略時は step / 2）
  label: string;    // 軸の変数名 (e.g., "x")
  unit?: string;    // 単位 (e.g., "分")
}

interface LineSpec {
  slope: number;
  intercept: number;
  dashed?: boolean;
  label?: string;   // 直線の横に添える式 (e.g., "y=6x+90")
}

interface FigureSpec {
  x: AxisSpec;
  y: AxisSpec;
  points?: [number, number][];
  lines?: LineSpec[];
  grid?: boolean;   // 方眼を描くか（省略時 true）
  width?: number;   // 表示幅 px（省略時 250）
  question?: Omit<Question, "figureSvg">;
}

const L = 34, T = 18, W = 200, H = 150; // 描画領域（viewBox 内の座標）
const BREAK = 10;                        // 波線で省略する部分の長さ

const fmt = (n: number) => +n.toFixed(1);
const range = (min: number, max: number, step: number) => {
  const out: number[] = [];
  for (let i = 0; min + i * step <= max + 1e-9; i++) out.push(+(min + i * step).toFixed(6));
  return out;
};

export function buildScatterSvg(spec: FigureSpec): string {
  const { x: X, y: Y } = spec;
  const breakX = X.min > 0, breakY = Y.min > 0;
  const px = (v: number) => fmt(L + (v - X.min) / (X.max - X.min) * W);
  const py = (v: number) => fmt(T + H - (v - Y.min) / (Y.max - Y.min) * H);
  // 原点（省略がある軸は波線の分だけ外側に出す）
  const ox = breakX ? L - BREAK : L;
  const oy = breakY ? T + H + BREAK : T + H;
  const s: string[] = [];

  if (spec.grid !== false) {
    for (const v of range(X.min, X.max, X.minor ?? X.step / 2)) {
      s.push(`<line x1="${px(v)}" y1="${T}" x2="${px(v)}" y2="${T + H}" stroke="#cbd5e1" stroke-width="${Math.abs(v / X.step - Math.round(v / X.step)) < 1e-9 ? 0.6 : 0.3}"/>`);
    }
    for (const v of range(Y.min, Y.max, Y.minor ?? Y.step / 2)) {
      s.push(`<line x1="${L}" y1="${py(v)}" x2="${L + W}" y2="${py(v)}" stroke="#cbd5e1" stroke-width="${Math.abs(v / Y.step - Math.round(v / Y.step)) < 1e-9 ? 0.6 : 0.3}"/>`);
    }
  }

  // 軸（省略部分は波線）
  if (breakX) {
    s.push(`<line x1="${ox}" y1="${oy}" x2="${ox + 3}" y2="${oy}" stroke="#1e293b"/>`);
    s.push(`<path d="M${ox + 3},${oy} l1.5,-3 l3,6 l1.5,-3" fill="none" stroke="#1e293b"/>`);
    s.push(`<line x1="${ox + 9}" y1="${oy}" x2="${L + W + 12}" y2="${oy}" stroke="#1e293b"/>`);
  } else {
    s.push(`<line x1="${ox}" y1="${oy}" x2="${L + W + 12}" y2="${oy}" stroke="#1e293b"/>`);
  }
  if (breakY) {
    s.push(`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - 3}" stroke="#1e293b"/>`);
    s.push(`<path d="M${ox},${oy - 3} l-3,-1.5 l6,-3 l-3,-1.5" fill="none" stroke="#1e293b"/>`);
    s.push(`<line x1="${ox}" y1="${oy - 9}" x2="${ox}" y2="${T - 10}" stroke="#1e293b"/>`);
  } else {
    s.push(`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${T - 10}" stroke="#1e293b"/>`);
  }

  // 目盛りラベル（0 は原点の O と重なるので省く）
  for (const v of range(X.min, X.max, X.step)) {
    if (v !== 0) s.push(`<text x="${px(v)}" y="${oy + 12}" text-anchor="middle">${v}</text>`);
  }
  for (const v of range(Y.min, Y.max, Y.step)) {
    if (v !== 0) s.push(`<text x="${ox - 4}" y="${py(v) + 3.5}" text-anchor="end">${v}</text>`);
  }
  s.push(`<text x="${ox - 6}" y="${oy + 12}" text-anchor="middle">O</text>`);
  const axisLabel = (a: AxisSpec) => `<tspan font-style="italic">${a.label}</tspan>${a.unit ? `(${a.unit})` : ""}`;
  s.push(`<text x="${L + W + 14}" y="${oy + 4}">${axisLabel(X)}</text>`);
  s.push(`<text x="${ox + 4}" y="${T - 8}">${axisLabel(Y)}</text>`);

  // 直線（描画範囲でクリップ）
  for (const ln of spec.lines ?? []) {
    const f = (v: number) => ln.slope * v + ln.intercept;
    const inv = (v: number) => (v - ln.intercept) / ln.slope;
    let x1 = X.min, x2 = X.max;
    if (ln.slope !== 0) {
      const a = inv(Y.min), b = inv(Y.max);
      x1 = Math.max(x1, Math.min(a, b));
      x2 = Math.min(x2, Math.max(a, b));
    }
    if (x1 >= x2) continue;
    s.push(`<line x1="${px(x1)}" y1="${py(f(x1))}" x2="${px(x2)}" y2="${py(f(x2))}" stroke="#1e293b" stroke-width="1"${ln.dashed ? ` stroke-dasharray="4 2"` : ""}/>`);
    if (ln.label) s.push(`<text x="${px(x2) - 2}" y="${py(f(x2)) - 4}" text-anchor="end" font-style="italic">${ln.label}</text>`);
  }

  for (const [x, y] of spec.points ?? []) {
    s.push(`<circle cx="${px(x)}" cy="${py(y)}" r="2.2" fill="#1e293b"/>`);
  }

  // 右端は x 軸ラベル分（約 40）の余白を確保
  const vbW = L + W + 14 + 40, vbH = oy + 18;
  return `<svg viewBox="0 0 ${vbW} ${vbH}" style="width:${spec.width ?? 250}px;max-width:100%" xmlns="http://www.w3.org/2000/svg" font-family="serif" font-size="10" fill="#1e293b">${s.join("")}</svg>`;
}

const [specPath, flag] = process.argv.slice(2);
if (!specPath) {
  console.error("usage: node scripts/gen-scatter-svg.mts <spec.json> [--svg]");
  process.exit(1);
}
const spec: FigureSpec = JSON.parse(readFileSync(specPath, "utf8"));
const svg = buildScatterSvg(spec);
if (flag === "--svg" || !spec.question) {
  console.log(svg);
} else {
  console.log(JSON.stringify({ ...spec.question, figureSvg: svg }, null, 2));
}
