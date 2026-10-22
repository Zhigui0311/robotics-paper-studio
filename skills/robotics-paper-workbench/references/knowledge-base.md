# 知识库格式与操作

skill 是规则和工具，library 是用户积累的资料；升级前者不覆盖后者。Python 3.9+，无第三方依赖、无网络调用、无 API 密钥。检索与阅读由执行 skill 的 AI 助手使用当时可用的网页/PDF工具完成。

## 文件布局

```text
robotics-paper-library/
  library.json          格式版本与语言，不保存机器专属路径
  records/<id>.json     论文元数据，唯一事实索引
  notes/<id>.md         精读笔记与人工批注
  attachments/          可合法保存的 PDF/图片/原文，使用相对路径
  searches/             带日期、查询与覆盖范围的检索日志
  comparisons/          有来源与可比性条件的比较报告
  history/              通过 add --update 更新前的记录/笔记快照
  index.md              自动生成的总表与多维分类索引
  bibliography.bib      自动生成的通用 BibTeX 引用条目
```

不要直接编辑生成的 index/bibliography。BibTeX 使用保守的 `@misc` 类型，不猜会议/期刊类型；正式投稿前按出版方元数据调整条目类型与作者格式。

## 元数据

从 `assets/record-template.json` 开始。模板的空标题/来源故意不能入库，必须填写已核实内容。

- `schema_version: 1`；`id` 首次可省略，脚本生成；后续保持稳定。
- `title`、`authors` 字符串数组、`year` 整数或 null、`venue` 字符串或 null。
- `identifiers` 支持 DOI、arXiv、OpenReview。DOI 规范化大小写与 URL；arXiv 去除 vN 用于去重，实际阅读版本记在 sources 的 version 中。
- `reading_status`: queued/skimmed/analyzed；`evidence_level`: metadata/abstract/fulltext/fulltext+code。
- `tags` 按 taxonomy.md 多维分类；`summary` 可用中文，利于中文检索。
- `sources` 至少一项。每项形如：

```json
{"url":"https://arxiv.org/abs/2303.04137","kind":"abstract","accessed":"2026-10-21","version":"当次核实的版本","locator":"Abstract"}
```

上面 URL 是格式示例，运行时核实身份与日期。kind 为 metadata/abstract/fulltext/code。访问 PDF 不等于阅读完整全文，等级由实际阅读范围决定。全文来源应记录已读章节和页码；代码来源记录路径与提交信息。

- `results` 可选。每项要求 task、metric、value、protocol、source、locator 六个非空字符串。数值不脱离协议；缺少的信息在 protocol 中明确标“未报告”，不要造结果。
- `relations` 可选。每项 target、kind、rationale；指向库内论文用 `local:<id>`，外部可用论文 URL/DOI。引用/基线/衍生关系应另带 source/locator；未经证实只标 `related`。
- `attachments` 使用 `attachments/...` 相对路径且文件需存在。
- `note_path` 由 `--note` 自动设为 `notes/<id>.md`。`analyzed` 必须有全文来源和非空笔记。脚本只检验结构，证据是否真实仍需读原文核实。
- 可增加技术路线等字段，脚本保留；不要在 JSON 中嵌入机器绝对路径或凭据。

## 操作示例

下文 `<skill>`、`<库>`、`<暂存>` 都替换为实际路径；含空格路径加引号。所有路径参数均可用绝对路径，不要求 cd 到 skill。

```text
python3 <skill>/scripts/kb.py --root <库> init
python3 <skill>/scripts/kb.py --root <库> add --record <暂存>/paper.json --note <暂存>/paper.md
python3 <skill>/scripts/kb.py --root <库> search --query "双臂 manipulation" --limit 10
python3 <skill>/scripts/kb.py --root <库> list --tag method=mpc --tag validation=real-robot
python3 <skill>/scripts/kb.py --root <库> similar <paper-id> --limit 5
python3 <skill>/scripts/kb.py --root <库> audit
python3 <skill>/scripts/kb.py --root <库> export --out <库外路径>/papers-backup.zip
```

search 对空格分隔的词做 OR 子串匹配，覆盖元数据及笔记，题名命中权重更高；多个 `--tag` 是 AND。不会自动翻译查询，必要时用中文/英文分别查。similar 按 task=4、method=3、action/observation=2、其他维度=1 的加权 Jaccard，再加题名/摘要词重叠；输出共同标签与词，不是语义模型，也不是技术优劣分数。

## 更新、去重和恢复

首次导入命中标识符会拒绝覆盖，并返回已有 ID。同题名同年份但没有共同标识符会提示人工核实，不盲目合并。

更新时先读取现有 JSON 和笔记，制作完整修订版，保留来源、批注及字段，再执行 `add --record <完整修订.json> [--note <合并后的笔记.md>] --update`。已分析记录应保留原有 id 和 note_path。不带 --note 时保留原笔记；带 --note 是替换整份笔记，需先合并用户批注。脚本保留更新前快照，并拒绝阅读等级自动降级。事实纠错确需降级时，在用户授权的库内备份后直接更正记录，运行 audit/reindex。

写入使用单写者锁和单文件原子替换；多个文件不是数据库事务。正常不要同时改同一个库；异常退出后检查 `.write-lock` 的 PID，确认进程结束再移除。失败后用 audit 检查并按 history 修复，reindex 重建视图。直接手改文件不会自动生成历史，修改前自行备份。

```text
python3 <skill>/scripts/kb.py --root <库> reindex
```

export 只打包库配置、生成索引及上述六个数据目录，拒绝覆盖已有 ZIP，输出必须位于库外。外链网页不会自动下载入包。迁移后执行 audit，确认附件与相对链接有效。
