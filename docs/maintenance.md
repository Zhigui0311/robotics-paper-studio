# 网站源码与后续维护

本仓库包含完整的网站工程和论文阅读 Skill。网站工程直接放在仓库根目录，对应开发电脑上的 `sites/robotics-paper-studio/`；克隆仓库后即可继续修改，无需额外获取一个 `sites` 文件夹。

## 从哪里开始

```sh
git clone https://github.com/Zhigui0311/robotics-paper-studio.git
cd robotics-paper-studio
```

按 [README 的本地启动步骤](../README.md#本地打开网页)安装依赖、初始化本地数据库，然后运行 `pnpm dev`，打开 `http://127.0.0.1:5173`。已有本地副本时，先提交或备份自己的改动，再用 `git pull --ff-only` 获取更新。

## 想改什么，对应哪些文件

| 修改内容 | 主要文件 |
| --- | --- |
| 导航、总览、论文库、阅读工作台、对比与迁移页面 | [app/page.tsx](../app/page.tsx) |
| 页面样式、布局与配色 | [app/globals.css](../app/globals.css)、[app/layout.tsx](../app/layout.tsx) |
| PDF 原文显示与逐页文本提取 | [components/paper-pdf.tsx](../components/paper-pdf.tsx)、[lib/browser-pdf.ts](../lib/browser-pdf.ts) |
| 论文导入、检索、分析保存及服务端处理 | [app/api/[...path]/route.ts](../app/api/[...path]/route.ts)、[lib/paper-server.ts](../lib/paper-server.ts) |
| 数据结构、字段校验与数据库迁移 | [lib/paper-types.ts](../lib/paper-types.ts)、[lib/paper-validation.ts](../lib/paper-validation.ts)、[db/schema.ts](../db/schema.ts)、[drizzle/](../drizzle/) |
| Codex 读取论文及写回分析的工具接口 | [app/mcp/route.ts](../app/mcp/route.ts) |
| 知识库备份和标准记录导出 | [lib/library-export.ts](../lib/library-export.ts) |
| 精读规则、技术路线拆解、分类与论文比较 | [skills/robotics-paper-workbench/](../skills/robotics-paper-workbench/) |
| 网站启动、构建和公开源码导出 | [scripts/](../scripts/)、[package.json](../package.json)、[vite.config.ts](../vite.config.ts) |
| 自动检查与正式版本发布 | [.github/workflows/ci.yml](../.github/workflows/ci.yml)、[docs/versioning.md](versioning.md) |

## 每次修改后如何保存

1. 根据上表修改源文件；如果改变数据库结构，生成并检查新增迁移，保留已有迁移。
2. 网站或脚本行为有变化时，运行下面的检查。仅文档修改时，核对说明、命令和链接即可。

   ```sh
   pnpm typecheck
   pnpm test
   pnpm test:skill
   pnpm build
   ```

3. 修改阅读 Skill 后，先把新增 Skill 源文件加入 Git，再运行 `pnpm package:skill`，刷新网站提供的下载包。
4. 在 [CHANGELOG.md](../CHANGELOG.md) 记录变化，提交并推送。可以创建开发分支并通过 Pull Request 合并；修改完成后让仓库保留相应提交记录。
5. 正式发布新版本时，按[版本流程](versioning.md)更新版本号、标签和 GitHub Release。一般文档或日常开发提交不必单独发布新版本。

仓库内的 [AGENTS.md](../AGENTS.md) 也规定了完成修改后检查、记录和同步的流程，便于后续让 Codex 接着维护。它不是监听本地文件变化的自动同步程序。

## 怎样更新线上网站

推送 GitHub 后，Actions 会验证代码；**更新线上网站还需要执行 Sites 发布流程**。GitHub 提交与网站部署分别记录，具体环境要求见[部署说明](deployment.md)。

- 更新自己的现有站点时，在 Sites 中选择那个站点，获取其当前源码与部署配置，保留该站点的 `project_id` 和现有访问设置，再合并 GitHub 上的修改并发布。不要为了更新现有站点而重新创建另一个站点。
- 新电脑上可以先从本仓库开发和验证。准备更新现有线上站点时，再通过 Sites 连接该站点并取得它的配置；公开仓库的 `.openai/hosting.json` 仅保留通用存储绑定及 MCP 能力声明。
- 从已有 Sites 工程同步到公开仓库时，先合并 GitHub 上较新的修改，再运行 `python3 scripts/export-public.py --out /path/to/public-checkout`。该工具会检查独立修改；出现冲突先处理，避免旧站点副本覆盖新文档或新代码。

## 哪些内容另行保存

GitHub 保存源码、阅读 Skill、数据库迁移、测试和构建脚本。依赖与构建产物可由仓库重建，因此本地的 `node_modules/`、`dist/`、旧部署 `.tar.gz` 不需要加入源码仓库。

个人论文、PDF、笔记与分析报告使用网站的「导出完整知识库」单独备份。线上数据在部署环境的 D1/R2 中，本地开发数据在 `.wrangler/state/` 中；克隆源码不会自动带回这些数据。阅读 Skill 的 ZIP 用于安装技能，知识库 ZIP 用于恢复论文和阅读积累。

`.sites-runtime/`、环境文件和账号凭据属于本机或部署环境，不放入公开仓库。公开源码不携带现有站点的身份，也不改变其访问范围。
