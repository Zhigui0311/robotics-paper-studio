# GitHub 记录与版本发布

每次完成修改后，先运行与变更有关的检查、更新 CHANGELOG，再提交并推送。Git 提交记录全部修改；正式版本另用 `vX.Y.Z` 标签和 GitHub Release 保存可下载包。

公开仓库：https://github.com/Zhigui0311/robotics-paper-studio，默认分支为 `main`。本机 Git 没有认证时，可通过已连接的 GitHub 工具写入，并把 GitHub 上的新历史拉回本地；不能强推覆盖远程历史。

## 日常修改

1. 拉取并核对已有修改，不覆盖其他贡献者的提交。
2. 修改代码、Skill 或文档，运行相应检查。
3. 在 CHANGELOG 中记录实际变化；正式版本更新 package.json 的版本号。
4. 提交并推送到配置好的 GitHub 仓库。

仓库的 `AGENTS.md` 要求后续 Codex 任务遵循此约定。这在有人执行修改时生效，不是监听硬盘变化的后台程序。

## 网站托管源码与公开仓库

Sites 管理的 checkout 需要保留真实 `.openai/hosting.json`。公开源码副本通过下面的命令更新：

```sh
python3 scripts/export-public.py --out /path/to/public-checkout
```

新增源码先明确加入 Git。导出工具只从 Git 跟踪文件选择项目源码，排除运行数据，移除托管项目身份，并记录文件哈希。未跟踪文件不会自动公开，下载目录仅发布已知的 Skill ZIP。后续同步会检查公开副本有没有独立改动；发现冲突会停止，先合并再更新，不强行覆盖。

公开仓库只需正常 commit/push。托管站点仍通过 Sites 发布；GitHub Actions 负责验证源码和生成发行版，不包含网站的部署凭据。

## 正式版本

更新 package.json 与 CHANGELOG 后：

```sh
pnpm check:release
git tag -a v0.2.0 -m "Release 0.2.0"
git push origin main
git push origin v0.2.0
```

将示例版本替换为实际版本。标签触发的 CI 全部通过后，Release job 使用 GitHub 自带的仓库令牌创建发行说明并上传 Skill ZIP。如果先在 GitHub 网页创建了同一版本的发行页，CI 会向该页补充下载包。不要移动已发布标签。首次开源版本为 0.2.0，Skill 保持自己的 1.1.0 版本。
