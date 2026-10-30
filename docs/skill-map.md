# 网站、Skill 与本地知识库对照

网站和 Skill 共用本仓库：网站负责存储与展示，Skill 负责阅读和证据判断。按钮生成指令，用户发送到 Codex 后才执行分析。

## 功能到源码

| 网站入口 / 结果 | 网站代码 | Skill 规则 / 本地模式 |
| --- | --- | --- |
| 导入论文、PDF 原文和解析文本 | `components/paper-pdf.tsx`、`lib/browser-pdf.ts`、`app/api/[...path]/route.ts` | `references/reading.md`：核实版本、逐页阅读与图表 |
| 阅读概览、技术路线、实验证据 | `lib/paper-types.ts` 的 `Analysis`、`lib/paper-validation.ts` | `references/site-bridge.md` 的分析字段；`assets/paper-note.md` 是本地笔记骨架 |
| 创建精读任务、复制指令 | `app/page.tsx`、`lib/skill-prompts.ts` | `SKILL.md` 选择工作范围，再按 `site-bridge.md` 连接指定网站 |
| 相似论文与在线检索 | `app/mcp/route.ts`、`lib/paper-server.ts` | `references/search-and-compare.md`；本地 `kb.py search` / `similar` |
| 论文对比及报告 | `lib/skill-prompts.ts`、`app/mcp/route.ts` | `references/search-and-compare.md`；比较条件与证据后保存 |
| 我的笔记、分类导航 | `app/page.tsx`、`lib/paper-types.ts` 的标签、`db/schema.ts` | `references/taxonomy.md`；本地记录使用多维分类 |
| Skill 下载 | `scripts/package-skill.py` → `public/downloads/robotics-paper-workbench.zip` | `skills/robotics-paper-workbench/` 是唯一编辑来源 |
| 导出与恢复知识库 | `lib/library-export.ts`、`lib/paper-server.ts` | `references/knowledge-base.md`、`scripts/kb.py` |

Skill 路径均相对于 `skills/robotics-paper-workbench/`。网站显示的摘要、训练、部署和实验字段来自结构化 `Analysis`；完整 Markdown 不是这些字段的替代品。

## Codex 工具到网站结果

| 工具 | 用途 / 页面结果 |
| --- | --- |
| `paper_list` | 定位当前网站内的论文与任务 |
| `paper_read` | 分页读文本、旧分析和独立用户笔记 |
| `paper_similar` | 库内相似候选；不代表已读或已验证 |
| `paper_search_web` | 公开 arXiv 候选检索 |
| `paper_save_analysis` | 更新概览、技术路线、实验证据与报告 |
| `paper_update_tags` | 更新分类导航使用的标签 |
| `comparison_save` / `comparison_list` | 保存 / 读取论文对比报告 |

真实工具参数以 `app/mcp/route.ts` 的 schema 为准；使用说明位于 Skill 的 `references/site-bridge.md`。修改接口时同时检查这两处及 `lib/skill-prompts.ts`。

## 两种存储模式

- **网站模式**：数据在该部署的 D1 / R2，按用户隔离。指定网站时通过其工具操作，避免同时新建本地重复库。
- **本地模式**：数据在用户指定的 `robotics-paper-library/`。`kb.py` 管理文件，不能直接修改线上 D1 / R2。
- **迁移**：网站完整备份 ZIP 中的 `studio.json` 用于网站恢复，标准库文件可由 `kb.py audit` / `reindex` 接续管理。下载 Skill ZIP 只安装工作流，不迁移论文。

## 修改时如何保持对应

1. 阅读规则改在 Skill 源码中；网站指令仅保留任务入口和当前论文上下文。
2. 分析字段改动同时检查类型、校验器、MCP schema、导出格式和 site-bridge 说明。
3. Skill 改动后先将文件加入 Git，再运行 `python3 scripts/package-skill.py`；不要直接修改下载 ZIP。
4. 按 [维护指南](maintenance.md) 检查；源码提交、下载包生成、线上部署分别确认。
