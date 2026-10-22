# 部署与运行

应用包含服务端 API、身份校验、D1 数据库和 R2 文件存储，需要支持 Cloudflare Workers 的部署环境。GitHub 仓库存放源码；GitHub Pages 只能提供静态文件，不能直接运行本应用的后端。

## 本地运行

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thankful_nemesis.sql
pnpm dev
```

迁移只在空数据库执行一次；后续按顺序执行新增迁移。浏览器打开终端显示的本地地址并登录测试身份。本地模拟身份只用于开发，生产构建不启用。Node.js 24、pnpm 11.25.0、Python 3.9+。

## Sites 托管

公开分发的 `.openai/hosting.json` 仅声明 `DB`、`BUCKET` 和 `mcp` 能力，不携带原作者的托管项目身份。在 Codex 中使用 Sites 插件，将 fork 作为新项目注册并写入平台返回的项目 ID，然后构建、生成迁移和发布。更新已有站点时保留那个站点自己的 ID。

Sites 提供登录、账户身份、D1/R2 绑定和网站 MCP 插件。论文和笔记属于当前部署的数据库，不随 Git 源码公开。

## 其他部署平台

本仓库保留了 Sites/Vinext 的集成。直接部署到其他 Workers 环境时，需要自行配置 D1/R2、迁移及可信身份入口，替换 Sites 专属登录和身份头处理。不能把来自公网客户端的 `oai-authenticated-user-id` 请求头直接当成已认证身份。本项目目前没有提供独立通用登录适配器。
