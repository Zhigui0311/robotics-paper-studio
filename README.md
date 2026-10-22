# Embodied Paper Studio · 具身论文工作台

开源的机器人与具身智能论文工作台，采用 MIT 许可。每个部署拥有自己的私人论文库。导入论文链接或本地 PDF，浏览原文与逐页文本，通过 Codex 的 `robotics-paper-workbench` Skill 精读、比较并写回结构化分析。

源码同时包含网站和 `skills/robotics-paper-workbench/` 阅读 Skill。当前网站版本为 **0.2.0**，Skill 版本为 **1.1.0**。

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

## 本地开发

推荐 Node 24、pnpm 11.25.0 和 Python 3.9+。使用 `pnpm install`，然后 `pnpm db:generate`（只有 schema 改动时），`pnpm build`。构建会自动准备 PDF.js 资源。

本地数据库与网站生产库分开。首次构建后执行：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thankful_nemesis.sql
pnpm dev
```

后续新增迁移按 `drizzle/` 顺序执行。不要重复应用已执行迁移。开发预览由 Sites 插件注入模拟身份，部署构建不包含这项模拟。

测试：`pnpm test`、`pnpm exec tsc --noEmit`。设置 `KB_SCRIPT` 为 Skill 内 kb.py 的路径时，测试还会用真实本地库校验器审查导出格式。`tests/api-smoke.mjs` 在本地预览上运行，生成并清理专用测试记录。

## Codex 连接

Sites 发布时建立个人插件。连接插件后，在 Codex 粘贴网站生成的精读指令；Skill 通过 `paper_list`、`paper_read`、`paper_similar`、`paper_search_web`、`paper_save_analysis`、`paper_update_tags`、`comparison_save`、`comparison_list` 完成读写。`POST /mcp` 支持 MCP 2026-07-28。

接口只检验结构与来源字段，不能自动保证研究结论正确。Skill 必须逐页阅读、核实图表、区分训练与部署，标记缺失证据。全文解析本身不会提高证据等级。个人笔记独立保存。

## 迁移

下载网站提供的 `robotics-paper-workbench.zip`，把整个 skill 文件夹复制到目标 AI 环境的 skill 目录。知识库使用网站「导出完整知识库」备份；在另一工作台中恢复 `studio.json` 或解压后由 `kb.py --root <目录> audit` / `reindex` 管理。PDF、笔记采用相对路径，无 API 密钥。

## 技术与授权

React / Vinext / Cloudflare Workers / D1 / R2 / PDF.js / fflate。PDF.js 资源的 Apache-2.0 授权位于 `public/pdf/LICENSE`（构建生成）。网站和自建 Skill 使用 MIT，第三方组件保留各自许可。公开的托管清单没有 project_id；注册自己的部署时写入平台返回的 ID。
