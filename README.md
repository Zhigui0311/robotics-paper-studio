# Embodied Paper Studio · 具身论文工作台

开源的机器人与具身智能论文工作台，采用 MIT 许可。每个部署拥有自己的私人论文库。导入论文链接或本地 PDF，浏览原文与逐页文本，通过 Codex 的 `robotics-paper-workbench` Skill 精读、比较并写回结构化分析。

源码同时包含网站和 `skills/robotics-paper-workbench/` 阅读 Skill。当前网站版本为 **0.2.0**，Skill 版本为 **1.1.0**。

## 如何打开网页

**已有托管入口：[打开具身论文工作台](https://robotics-paper-studio-edy.divinetiger19.chatgpt.site/)。** 在浏览器打开后，若看到「登录」按钮，先按页面提示登录。访问范围以该站点当前的权限设置为准；遇到无权限提示时，可以[本地运行](#本地打开网页)，或按[部署说明](docs/deployment.md)创建自己的站点。

使用在线网页无需在本机安装 Node.js 或 Python。GitHub 仓库用于获取源码和查看版本记录；下载源码 ZIP 后，需要按下方步骤启动服务才能打开本地网页。

## 第一次使用

1. 点击右上角「导入论文」，选择「论文链接」或「本地 PDF」。链接支持 arXiv、DOI 和其他 HTTPS 地址；选择「导入并解析」后等待导入完成。PDF 上限为 **25 MB、400 页**，扫描件请先 OCR。
2. 在「我的论文库」点击论文标题，进入「阅读工作台」。左侧切换「论文原文 / 解析文本」，右侧查看「阅读概览 / 技术路线 / 实验证据 / 我的笔记」。刚导入的论文可能尚无精读分析。
3. 需要 AI 精读时，先按 [Skill 安装说明](skills/robotics-paper-workbench/README.md)安装阅读 Skill，并在 Codex 中连接当前网站的个人插件。点击「交给 Codex 精读」或「创建精读任务并复制指令」，将复制的指令发送到 Codex 对话。
4. Codex 读取论文并保存分析后，回到网站重新打开该论文，查看主要框架、技术路线、实验依据、限制和分类。网站按钮负责创建待办与复制指令，精读由你发起的 Codex 对话执行。
5. 比较论文时，在「论文对比」选择 **2–4 篇**论文，点击「复制 Codex 对比指令」并发送给 Codex；报告写回后点击「刷新结果」。
6. 在「分类导航」按标签浏览；在论文的「我的笔记」中编辑笔记和分类标签。
7. 在「Skill 与迁移」下载阅读 Skill，或使用「导出完整知识库」备份论文、PDF、笔记和分析。恢复时使用「导入知识库备份」上传网站导出的完整 ZIP，包内须含 `studio.json`。Skill 包与知识库备份分别迁移。

## 功能

- 研究总览、论文库、阅读工作台、论文对比、分类导航、Skill 与迁移。
- arXiv / DOI 元数据、公开 arXiv 检索；其他 HTTPS 链接可以收藏。服务器仅自动下载允许的学术域名，其他来源请上传本地 PDF。
- PDF.js 在浏览器按页提取文字，PDF 和文本写入 R2；最多 25 MB、400 页。扫描件需要先 OCR，公式和图表要对照原文。
- D1 持久保存记录、标签、个人笔记、分析与比较报告，按平台认证用户隔离。
- 网站创建精读待办并复制指令；用户在 Codex 发起阅读，MCP 工具读取论文并保存结果。没有独立模型 API 调用或自动后台精读。
- ZIP 导出包含原文、逐页文本、Markdown、BibTeX 和标准 skill 记录，可用网站恢复，也可用 Python 标准库脚本继续管理。

## 开源与版本

- [MIT 许可](LICENSE)、[第三方许可](THIRD_PARTY_NOTICES.md)、[更新记录](CHANGELOG.md)。
- [贡献指南](CONTRIBUTING.md)、[部署说明](docs/deployment.md)、[GitHub 版本流程](docs/versioning.md)。
- 每次推送和 Pull Request 运行类型检查、网站/Skill 测试与构建；正式 `vX.Y.Z` 标签通过检查后生成 GitHub Release。
- 源码不包含用户论文、笔记、数据库或原作者托管项目身份。论文库通过网站单独备份。

## 本地打开网页

先安装 **Node.js 24** 和 **pnpm 11.25.0**；使用 Skill 的本地知识库脚本还需要 Python 3.9+。在终端执行：

```sh
git clone https://github.com/Zhigui0311/robotics-paper-studio.git
cd robotics-paper-studio
pnpm install --frozen-lockfile
pnpm build
```

首次运行时，初始化本地数据库，再启动开发服务器：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thankful_nemesis.sql
pnpm dev
```

保持终端运行，在浏览器打开 **[http://127.0.0.1:5173](http://127.0.0.1:5173)**。若启动时提示 5173 端口被占用，请停止占用该端口的服务后重试。页面出现「登录」时点击即可进入本地测试账户；模拟登录由仓库内的开发插件提供，本地浏览无需另装 Sites 插件。部署构建不包含这项模拟。

以后启动只需在项目目录执行 `pnpm dev`。本地数据库与线上论文库分开保存，停止服务后本地数据仍保留在 `.wrangler/state/`。需要线上已有的论文时，先从线上导出知识库，再在本地网页导入。

本项目包含服务端、D1 数据库和 R2 文件存储，**GitHub Pages 无法直接运行完整应用**。自建在线网页请阅读[部署说明](docs/deployment.md)，配置对应的存储和登录环境。

## 开发检查

构建会自动准备 PDF.js 资源。只有 schema 改动时才运行 `pnpm db:generate`；后续新增迁移按 `drizzle/` 顺序执行，不要重复应用已执行迁移。

测试：`pnpm test`、`pnpm exec tsc --noEmit`。设置 `KB_SCRIPT` 为 Skill 内 kb.py 的路径时，测试还会用真实本地库校验器审查导出格式。`tests/api-smoke.mjs` 在本地预览上运行，生成并清理专用测试记录。

## Codex 连接

Sites 发布时建立个人插件。连接插件后，在 Codex 粘贴网站生成的精读指令；Skill 通过 `paper_list`、`paper_read`、`paper_similar`、`paper_search_web`、`paper_save_analysis`、`paper_update_tags`、`comparison_save`、`comparison_list` 完成读写。`POST /mcp` 支持 MCP 2026-07-28。

接口只检验结构与来源字段，不能自动保证研究结论正确。Skill 必须逐页阅读、核实图表、区分训练与部署，标记缺失证据。全文解析本身不会提高证据等级。个人笔记独立保存。

## 迁移

下载网站提供的 `robotics-paper-workbench.zip`，把整个 skill 文件夹复制到目标 AI 环境的 skill 目录。知识库使用网站「导出完整知识库」备份；在另一工作台的「导入知识库备份」中上传含 `studio.json` 的完整 ZIP，或解压后由 `kb.py --root <目录> audit` / `reindex` 管理。PDF、笔记采用相对路径，无 API 密钥。

## 技术与授权

React / Vinext / Cloudflare Workers / D1 / R2 / PDF.js / fflate。PDF.js 资源的 Apache-2.0 授权位于 `public/pdf/LICENSE`（构建生成）。网站和自建 Skill 使用 MIT，第三方组件保留各自许可。公开的托管清单没有 project_id；注册自己的部署时写入平台返回的 ID。
