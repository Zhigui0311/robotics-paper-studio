import type { Paper } from "./paper-types.ts";

/** Website-to-Skill handoff. Keep the tool contract in sync with site-bridge.md. */
export function readingPrompt(
  origin: string,
  p: Pick<Paper, "id" | "title" | "readingScope">,
): string {
  return `使用 $robotics-paper-workbench，通过网站 ${origin} 的论文工具精读论文「${p.title}」（ID: ${p.id}）。先用 paper_read 分页读取原文，查看原始图表，解释关键框架、训练与部署、动作接口、实验依据与局限；用 paper_similar 和在线检索比较相似论文；用 paper_save_analysis 保存分析与分类。保留用户笔记。当前阅读重点：${p.readingScope || "机器人、具身智能与运动控制技术路线"}。只拿到摘要时明确标注摘要级，不冒充全文精读。`;
}

export function comparisonPrompt(
  origin: string,
  paperIds: readonly string[],
): string {
  return `使用 $robotics-paper-workbench，通过 ${origin} 的论文工具比较论文 ID：${paperIds.join("、")}。读取每篇原文与已有分析，重点比较技术路线、数据、动作接口、控制闭环、真机证据与局限，标注可比性。用 comparison_save 保存 Markdown 报告，paperIds 使用以上 ID。`;
}
