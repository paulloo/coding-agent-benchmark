import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coding Agent Benchmark",
  description: "可复现的 AI Coding Agent 横向评测平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
          <Sidebar />
          <main className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
