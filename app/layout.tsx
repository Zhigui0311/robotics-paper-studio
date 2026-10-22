import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embodied · 具身论文工作台",
  description: "连接论文、理解技术、积累研究。机器人与具身智能的私人论文工作台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
