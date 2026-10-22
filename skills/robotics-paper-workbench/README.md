# 机器人论文研究工作台

一个 skill，覆盖机器人、具身智能、运动规划与控制论文的发现、精读、比较和分类积累。默认中文输出，保留英文术语。采用开放的 SKILL.md 目录结构；核心内容不绑定某一家模型服务。

## 直接使用

在支持技能发现的 AI 助手中安装整个 `robotics-paper-workbench/` 文件夹。在 Codex 中目标位置是 `~/.codex/skills/robotics-paper-workbench/`（若配置了 CODEX_HOME，使用它的 skills 子目录）。安装后在下一轮调用：

```text
$robotics-paper-workbench 精读这篇论文：[链接或 PDF]。
拆解主要框架、训练和部署流程，解释关键公式，查找相似论文并分类入库。
知识库使用：[你的 robotics-paper-library 路径]。
```

也可以说：

- “找双臂柔性物体操作的相关论文，先从我的库里查，再查公开论文库，给出五篇候选和纳入理由。”
- “把这篇论文和库里的 ACT、Diffusion Policy 对比，重点看动作接口、数据需求、控制频率与真机证据。”
- “按 MPC、强化学习和模仿学习整理我的运动控制论文，找出尚未读全文的条目。”

其他支持 Agent Skills 的助手：复制到该产品支持的 skills 目录，按其文档加载。没有技能安装机制但能读文件的助手：让它先读取此目录的 SKILL.md，再按相对链接读取所需参考文件。工具权限与上下文能力仍取决于宿主环境；无法保证所有产品自动发现。

## 你会得到什么

- 精读卡：研究问题、技术贡献、信息流/控制闭环、训练与部署、公式、实验依据、局限和复现条件。
- 比较报告：本地库＋公开检索的相似工作，逐项比较方法与实验条件，不强行跨基准排名。
- 长期知识库：Markdown 笔记、JSON 元数据、分类索引、BibTeX、检索日志和更新历史。

知识库初始为空，不内置伪造的论文记录。检索得到的候选与已分析论文有不同状态；以后每次使用逐步积累。

## 迁移与备份

需要保存两个独立目录：

1. `robotics-paper-workbench/`：这个 skill 的规则、模板和脚本。
2. `robotics-paper-library/`：你实际使用的知识库，包含笔记、索引及附件。

换电脑或换助手时复制这两个目录，在新对话说明新的知识库路径。也可设置 `ROBOTICS_PAPER_KB` 指向固定库；当前项目库优先，明确指定路径优先级最高。库内链接使用相对路径，库不依赖本机用户名、聊天 ID 或云服务。

发布的 portable ZIP 是交付时快照。后续迁移一定复制最新的实际知识库，不能只拿最初空库 ZIP。用 `scripts/kb.py --root <库> export --out <库外>/backup.zip` 可导出最新库。具体命令和格式见 [知识库说明](references/knowledge-base.md)。

## 依赖与边界

本地工具仅需 Python 3.9+ 标准库，无付费 API、数据库服务、嵌入服务或特定 MCP 的硬依赖。在线检索和 PDF 阅读使用助手实际具备的工具；离线时只分析已有材料，明确搜索缺口。扫描 PDF 的 OCR、私人 Zotero 等库的连接和付费全文访问由环境提供，不随 skill 自动获得。

skill 负责指导 AI 研究，Python 工具负责整理与检索文件；脚本本身不理解论文。它不在后台持续联网，也不保证研究结论无需人工复核。

## 自检

```text
python3 scripts/test_kb.py
python3 scripts/kb.py --root <库> audit
```

## 设计来源与许可

本 skill 为当前需求独立编写，没有复制第三方 skill 源码。选型时参考了公开方案的能力边界：[机器人方向 literature-review](https://github.com/JakobThumm/literature-review/blob/main/SKILL.md) 偏文献综述，[UCL-ERL paper-reading-card](https://github.com/UCL-ERL/skills/blob/main/skills/research/paper-reading-card/SKILL.md) 偏单篇阅读卡。因此在这里整合领域精读、相似检索、多维分类与可迁移库维护为一个入口。

目录格式参考 [Agent Skills specification](https://agentskills.io/specification)。本目录内容按 [MIT](LICENSE) 提供，可复制、修改和分发；论文原文及第三方附件沿用各自许可，不由本许可重新授权。核查日期：2026-10-21。

## 网站工作台（可选）

网站保存 PDF、解析文本、分类与分析结果；Codex 使用本 skill 和网站提供的论文工具精读并写回，无需另配模型 API。导入论文后点击「交给 Codex 精读」，将生成的指令粘贴到 Codex。首次连接在「插件 → 个人 → 由你创建」找到工作台插件。

网站导出的 ZIP 同时含可在网站恢复的 studio.json 和兼容 kb.py 的本地知识库。解压后执行 audit/reindex；不用网站也能独立阅读和管理库。具体工具和证据规则见 references/site-bridge.md。
