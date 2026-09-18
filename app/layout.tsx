import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI ミニテストメーカー (Mini Test Maker)",
  description: "20分小テストを最短工数で作成・印刷・データ化するAI教育ツール",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-800 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
