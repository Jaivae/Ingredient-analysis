import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "加工食品配料表解析与健康关注提示",
  description: "基于 OCR 与大语言模型的加工食品配料表解析 Web 原型系统"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
