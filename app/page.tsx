"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Command,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  GitCompareArrows,
  Layers3,
  LayoutDashboard,
  Link2,
  Loader2,
  Menu,
  Microscope,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EVIDENCE, STATUS, TAG_GROUPS, TAG_LABELS } from "@/lib/paper-types";
import type { Paper, PaperPage, Comparison } from "@/lib/paper-types";
import { similarity } from "@/lib/paper-validation";
import { portableFiles } from "@/lib/library-export";
import { PaperPDF } from "@/components/paper-pdf";
import { parsePDF } from "@/lib/browser-pdf";
import { readingPrompt, comparisonPrompt } from "@/lib/skill-prompts";

type View = "overview" | "library" | "reader" | "compare" | "topics" | "skill";
const NAV = [
  { id: "overview", label: "研究总览", icon: LayoutDashboard },
  { id: "library", label: "我的论文库", icon: BookOpen },
  { id: "reader", label: "阅读工作台", icon: FileText },
  { id: "compare", label: "论文对比", icon: GitCompareArrows },
  { id: "topics", label: "分类导航", icon: Tags },
] as const;
const STARTERS = [
  {
    name: "Diffusion Policy",
    title: "Visuomotor Policy Learning via Action Diffusion",
    tag: "扩散策略",
    year: 2023,
    url: "https://arxiv.org/abs/2303.04137",
    color: "mint",
    description: "从动作分布出发，理解生成式机器人策略。",
  },
  {
    name: "ACT · ALOHA",
    title: "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware",
    tag: "双臂操作",
    year: 2023,
    url: "https://arxiv.org/abs/2304.13705",
    color: "sand",
    description: "从动作分块出发，理解双臂精细操作。",
  },
];
async function api(path: string, method = "GET", data?: unknown) {
  const res = await fetch("/api/" + path, {
    method,
    headers:
      data instanceof FormData
        ? undefined
        : data
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json.error || "请求失败");
  return json;
}
function download(name: string, data: BlobPart, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"pill " + tone}>{children}</span>;
}
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand-mark " + (small ? "small" : "")}>
      <Layers3 size={small ? 19 : 23} />
    </span>
  );
}
function Empty({
  icon: Icon = BookOpen,
  title,
  description,
  action,
}: {
  icon?: typeof BookOpen;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Rich({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
export default function Studio() {
  const [view, setView] = useState<View>("overview"),
    [papers, setPapers] = useState<Paper[]>([]),
    [comparisons, setComparisons] = useState<Comparison[]>([]),
    [active, setActive] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [signedIn, setSignedIn] = useState(true),
    [loadError, setLoadError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [tag, setTag] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(""),
    [mobile, setMobile] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [attachId, setAttachId] = useState<string | null>(null);
  const [modal, setModal] = useState(false),
    [importMode, setImportMode] = useState<"url" | "file">("url"),
    [link, setLink] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [meta, setMeta] = useState<any>(null),
    [title, setTitle] = useState(""),
    [importError, setImportError] = useState("");
  const [pages, setPages] = useState<PaperPage[]>([]),
    [pageTab, setPageTab] = useState("pdf"),
    [analysisTab, setAnalysisTab] = useState("overview"),
    [note, setNote] = useState(""),
    [pageNum, setPageNum] = useState(1),
    [readerError, setReaderError] = useState("");
  const [webQuery, setWebQuery] = useState(""),
    [webResults, setWebResults] = useState<any[]>([]),
    [webError, setWebError] = useState(""),
    [compareId, setCompareId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    archiveInput = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const paper = papers.find((p) => p.id === active) || null;
  const counts = {
    all: papers.length,
    analyzed: papers.filter((p) => p.status === "analyzed").length,
    queued: papers.filter((p) => p.status === "queued").length,
    tags: new Set(papers.flatMap((p) => p.tags)).size,
  };
  const filtered = useMemo(
    () =>
      papers.filter(
        (p) =>
          (filter === "all" || p.status === filter) &&
          (!tag || p.tags.includes(tag)) &&
          (!query ||
            (
              p.title +
              " " +
              p.authors.join(" ") +
              " " +
              p.tags.map((t) => TAG_LABELS[t] || t).join(" ") +
              " " +
              (p.analysis?.summary || "")
            )
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [papers, filter, tag, query],
  );
  const related = paper
    ? papers
        .filter((p) => p.id !== paper.id)
        .map((p) => ({ paper: p, ...similarity(paper, p) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];
  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 4500);
  }
  function navigate(v: View) {
    setView(v);
    setMobile(false);
    window.history.replaceState(null, "", "#" + v);
  }
  async function refresh() {
    setLoadError("");
    try {
      const [p, c] = await Promise.all([api("papers"), api("comparisons")]);
      setPapers(p);
      setComparisons(c);
      setSignedIn(true);
    } catch (e) {
      setLoadError((e as Error).message);
      if ((e as Error).message.includes("登录")) setSignedIn(false);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const hash = window.location.hash.slice(1) as View;
    if (
      ["overview", "library", "reader", "compare", "topics", "skill"].includes(
        hash,
      )
    )
      setView(hash);
    refresh();
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!paper) {
      setPages([]);
      return;
    }
    setPageNum(1);
    setReaderError("");
    setPages([]);
    let cancelled = false;
    api("papers/" + paper.id + "/text")
      .then((p) => {
        if (!cancelled) setPages(p);
      })
      .catch((e) => {
        if (!cancelled) setReaderError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [active, paper?.textChars, paper?.pageCount]);
  useEffect(() => {
    setNote(paper?.userNotes || "");
  }, [paper?.id]);
  useEffect(() => {
    if (!papers.some((p) => p.status === "queued")) return;
    const t = setInterval(() => refresh(), 30000);
    return () => clearInterval(t);
  }, [papers.some((p) => p.status === "queued")]);
  function open(p: Paper) {
    setActive(p.id);
    navigate("reader");
    setAnalysisTab("overview");
  }
  function showImport(url = "") {
    setAttachId(null);
    setLink(url);
    setFile(null);
    setMeta(null);
    setTitle("");
    setImportError("");
    setImportMode(url ? "url" : "url");
    setModal(true);
  }
  async function resolve() {
    setBusy("正在获取论文信息");
    setImportError("");
    try {
      const m = await api("resolve", "POST", { url: link });
      setMeta(m);
      setTitle(m.title);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function parseSaved(p: Paper, data?: ArrayBuffer) {
    setBusy("正在读取 PDF");
    const buffer =
      data ||
      (await (await fetch("/api/papers/" + p.id + "/file")).arrayBuffer());
    const extracted = await parsePDF(buffer, setBusy);
    setBusy("正在保存逐页文本");
    await api("papers/" + p.id + "/text", "POST", extracted);
    return extracted;
  }
  async function importCurrent() {
    setBusy("正在导入论文");
    setImportError("");
    let imported: Paper | null = null;
    try {
      let m = meta;
      if (importMode === "url" && !m)
        m = await api("resolve", "POST", { url: link });
      const data = {
        ...(m || {}),
        title:
          title.trim() ||
          m?.title ||
          file?.name.replace(/\.pdf$/i, "") ||
          "未命名论文",
        fileName: file?.name || "",
      };
      let r;
      if (importMode === "file") {
        if (!file) throw new Error("请先选择 PDF");
        if (file.size > 25 * 1024 * 1024) throw new Error("文件超过 25 MB");
        const f = new FormData();
        f.append("metadata", JSON.stringify(data));
        f.append("file", file);
        r = await api(
          attachId ? "papers/" + attachId + "/upload" : "papers",
          "POST",
          f,
        );
      } else r = await api("papers", "POST", data);
      imported = r.paper;
      setModal(false);
      setActive(r.paper.id);
      navigate("reader");
      await refresh();
      if (
        file &&
        importMode === "file" &&
        (!r.duplicate || r.paper.textChars === 0)
      )
        await parseSaved(r.paper, await file.arrayBuffer());
      else if (m?.pdfUrl && !r.paper.textChars) {
        setBusy("正在下载论文原文");
        const p = await api("papers/" + r.paper.id + "/download", "POST", {
          url: m.pdfUrl,
        });
        await parseSaved(p);
      }
      notify(r.duplicate ? "论文已存在，已打开现有记录" : "论文已导入");
      await refresh();
    } catch (e) {
      if (imported) {
        notify("论文已保存；解析未完成：" + (e as Error).message);
        await refresh();
      } else setImportError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function queue(p: Paper) {
    setBusy("正在创建阅读任务");
    try {
      await api("papers/" + p.id, "PATCH", { status: "queued" });
      await refresh();
      setTaskPrompt(promptFor(p));
      try {
        await copyPrompt(p);
        notify("精读指令已复制，粘贴到 Codex 开始阅读。");
      } catch {
        notify("精读任务已创建，请复制下方指令到 Codex。");
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function promptFor(p: Paper) {
    return readingPrompt(location.origin, p);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("已复制到剪贴板");
    } catch {
      setTaskPrompt(text);
      notify("请选中指令并复制");
    }
  }
  async function copyPrompt(p: Paper) {
    await navigator.clipboard.writeText(promptFor(p));
  }
  async function saveNote() {
    if (!paper) return;
    setBusy("正在保存笔记");
    try {
      await api("papers/" + paper.id, "PATCH", { userNotes: note });
      await refresh();
      notify("笔记已保存");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function editTags(p: Paper, t: string) {
    try {
      await api("papers/" + p.id, "PATCH", {
        tags: p.tags.includes(t)
          ? p.tags.filter((x) => x !== t)
          : [...p.tags, t],
      });
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function searchWeb() {
    setBusy("正在检索 arXiv");
    setWebError("");
    try {
      setWebResults(await api("discover?q=" + encodeURIComponent(webQuery)));
    } catch (e) {
      setWebError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function exportLibrary() {
    setBusy("正在打包知识库");
    try {
      const { zipSync, strToU8 } = await import("fflate");
      const entries: Record<string, Uint8Array> = Object.fromEntries(
        Object.entries(portableFiles(papers, comparisons)).map(
          ([name, value]) => [name, strToU8(value)],
        ),
      );
      for (const p of papers) {
        entries[`text/${p.id}.json`] = strToU8(
          JSON.stringify(await api("papers/" + p.id + "/text")),
        );
        if (p.hasPdf) {
          setBusy("正在打包：" + p.title.slice(0, 25));
          const res = await fetch("/api/papers/" + p.id + "/file");
          if (!res.ok) throw new Error("PDF 导出失败");
          entries[`attachments/${p.id}.pdf`] = new Uint8Array(
            await res.arrayBuffer(),
          );
        }
      }
      for (const c of comparisons)
        entries[`comparisons/${c.id}.md`] = strToU8(c.markdown);
      const zipped = zipSync(entries);
      download(
        "embodied-library-" + new Date().toISOString().slice(0, 10) + ".zip",
        zipped as unknown as BlobPart,
        "application/zip",
      );
      notify("论文、原文和分析已导出");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function importArchive(file: File) {
    setBusy("正在恢复知识库");
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("导入包最大 100 MB");
      const { unzipSync, strFromU8 } = await import("fflate");
      let total = 0,
        count = 0;
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => {
          total += entry.originalSize;
          if (total > 200 * 1024 * 1024 || ++count > 8000)
            throw new Error("解压后内容超过导入上限");
          return true;
        },
      });
      if (!files["studio.json"])
        throw new Error("请选择本网站导出的知识库 ZIP");
      const archive = JSON.parse(strFromU8(files["studio.json"]));
      if (
        archive.version !== 1 ||
        !Array.isArray(archive.papers) ||
        archive.papers.length > 1000
      )
        throw new Error("导出包版本或格式不支持");
      const map: Record<string, string> = {};
      for (const p of archive.papers) {
        setBusy("正在恢复：" + p.title.slice(0, 25));
        let result;
        const pdf = files[`attachments/${p.id}.pdf`];
        if (pdf) {
          const f = new FormData();
          f.append("metadata", JSON.stringify(p));
          f.append(
            "file",
            new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }),
            p.fileName || "paper.pdf",
          );
          result = await api("papers", "POST", f);
        } else result = await api("papers", "POST", p);
        map[p.id] = result.paper.id;
        if (result.duplicate) continue;
        const txt = files[`text/${p.id}.json`];
        if (txt) {
          const pages = JSON.parse(strFromU8(txt));
          if (pages.length)
            await api("papers/" + result.paper.id + "/text", "POST", pages);
        }
        await api("papers/" + result.paper.id, "PATCH", {
          userNotes: p.userNotes || "",
          tags: p.tags || [],
        });
        if (p.analysis)
          await api("papers/" + result.paper.id + "/analysis", "POST", {
            analysis: {
              ...p.analysis,
              sources: p.analysis.sources.map((s: any) => ({
                ...s,
                url: s.url.startsWith("attachments/")
                  ? `attachments/${result.paper.id}.pdf`
                  : s.url,
              })),
            },
            tags: p.tags,
          });
      }
      for (const c of archive.comparisons || []) {
        const ids = c.paperIds.map((id: string) => map[id]).filter(Boolean);
        if (ids.length >= 2)
          await api("comparisons", "POST", {
            title: c.title,
            markdown: c.markdown,
            paperIds: ids,
          });
      }
      await refresh();
      notify("知识库已恢复；已有论文保持不变");
    } catch (e) {
      notify("恢复未完成：" + (e as Error).message);
      await refresh();
    } finally {
      setBusy("");
    }
  }
  function toggleSelect(id: string) {
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length < 4
          ? [...s, id]
          : s,
    );
  }
  const heading = {
    overview: "研究总览",
    library: "我的论文库",
    reader: "阅读工作台",
    compare: "论文对比",
    topics: "分类导航",
    skill: "Skill 与迁移",
  }[view];
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <Mark />
          <span>
            embodied<span className="brand-sub">PAPER STUDIO</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">E</span>
          <div>
            我的研究空间<small>个人论文知识库</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">工作空间</div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={"nav-item " + (view === n.id ? "active" : "")}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "library" && (
                <span className="nav-count">{papers.length}</span>
              )}
              {n.id === "reader" && counts.queued > 0 && (
                <span className="nav-count">{counts.queued}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-caption collections-caption">
          研究方向<span>+</span>
        </div>
        <div className="collections">
          {["bimanual-manipulation", "diffusion-policy", "mpc"].map((t, i) => (
            <button
              key={t}
              onClick={() => {
                setTag(t);
                setFilter("all");
                navigate("library");
              }}
            >
              <i className={"topic-dot dot-" + i} />
              {TAG_LABELS[t]}
              <span>{papers.filter((p) => p.tags.includes(t)).length}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="skill-card">
            <span className="skill-spark">
              <Sparkles size={18} />
            </span>
            <strong>让阅读持续积累</strong>
            <p>
              连接 Codex Skill，让每篇论文
              <br />
              成为可复用的研究知识。
            </p>
            <button onClick={() => navigate("skill")}>
              查看阅读工作流 <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={"nav-item " + (view === "skill" ? "active" : "")}
            onClick={() => navigate("skill")}
          >
            <Settings2 size={18} />
            Skill 与迁移
          </button>
          <div className="account">
            <span className="avatar">研</span>
            <div>
              个人研究者
              <small>
                <span className="online-dot" /> 私人工作空间
              </small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="关闭导航"
          className="sidebar-scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="打开导航"
            >
              <Menu size={20} />
            </button>
            <span>工作空间</span>
            <ChevronRight size={14} />
            <strong>{heading}</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Search size={16} />
              <input
                ref={searchInput}
                placeholder="搜索论文、作者或标签…"
                aria-label="搜索论文"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  navigate("library");
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <span className="private-label">
              <ShieldCheck size={14} />
              仅自己可见
            </span>
            {!signedIn ? (
              <a
                className="button primary"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                登录
              </a>
            ) : (
              <button className="button primary" onClick={() => showImport()}>
                <Plus size={16} />
                导入论文
              </button>
            )}
          </div>
        </header>
        <main
          className={"content " + (view === "reader" ? "reader-content" : "")}
        >
          {loadError && (
            <div className="notice error">
              <span>{loadError}</span>
              <button onClick={() => refresh()}>重新加载</button>
            </div>
          )}
          {view === "overview" && (
            <>
              <section className="welcome">
                <div>
                  <div className="eyebrow">
                    <span /> YOUR RESEARCH, CONNECTED
                  </div>
                  <h1>
                    每一次阅读，
                    <br className="small-only" />
                    都通向新的发现<span className="title-dot">.</span>
                  </h1>
                  <p>连接机器人与具身智能论文，把技术思路沉淀成自己的知识。</p>
                </div>
                <div className="date-chip">
                  <span>研究日志</span>
                  <strong>
                    {new Intl.DateTimeFormat("zh-CN", {
                      month: "long",
                      day: "numeric",
                      timeZone: "Asia/Shanghai",
                    }).format(new Date())}
                  </strong>
                </div>
              </section>
              <div className="stats-grid">
                {[
                  {
                    label: "已收藏论文",
                    value: counts.all,
                    icon: BookOpen,
                    sub: "你的研究积累",
                    color: "mint",
                  },
                  {
                    label: "完成全文精读",
                    value: counts.analyzed,
                    icon: CheckCheck,
                    sub: "有原文依据的分析",
                    color: "blue",
                  },
                  {
                    label: "待精读任务",
                    value: counts.queued,
                    icon: Workflow,
                    sub: "等待 Codex 阅读",
                    color: "sand",
                  },
                  {
                    label: "研究标签",
                    value: counts.tags,
                    icon: Tags,
                    sub: "跨论文连接知识",
                    color: "lavender",
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <div className="stat-label">
                      {s.label}
                      <span className={"stat-icon " + s.color}>
                        <s.icon size={17} />
                      </span>
                    </div>
                    <strong>{s.value.toString().padStart(2, "0")}</strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <div>
                  <section className="import-hero">
                    <div className="hero-copy">
                      <Pill tone="green">从一篇论文开始</Pill>
                      <h2>
                        把论文放进来，
                        <br />
                        让研究思路清晰起来。
                      </h2>
                      <p>
                        粘贴论文链接，或拖入本地 PDF。
                        <br />
                        原文、技术路线和阅读笔记，都在同一个地方。
                      </p>
                      <div className="button-row">
                        <button
                          className="button primary"
                          onClick={() => showImport()}
                        >
                          <Link2 size={16} />
                          粘贴论文链接
                        </button>
                        <button
                          className="button light"
                          onClick={() => {
                            showImport();
                            setImportMode("file");
                          }}
                        >
                          <Upload size={16} />
                          上传 PDF
                        </button>
                      </div>
                      <small>支持 arXiv、DOI、论文链接与本地 PDF</small>
                    </div>
                    <div className="paper-art" aria-hidden="true">
                      <div className="art-grid" />
                      <div className="floating-tag">
                        <span className="online-dot" /> From papers to knowledge
                      </div>
                      <div className="art-paper">
                        <div className="art-kicker">ROBOT LEARNING</div>
                        <div className="art-title">
                          Perception.
                          <br />
                          Policy.
                          <br />
                          <em>Possibility.</em>
                        </div>
                        <div className="art-rule" />
                        <div className="art-flow">
                          <span>观察</span>
                          <ArrowRight size={13} />
                          <span>决策</span>
                          <ArrowRight size={13} />
                          <span>行动</span>
                        </div>
                        <div className="art-lines">
                          <i />
                          <i />
                          <i />
                        </div>
                        <span className="art-page">01 / KNOWLEDGE</span>
                      </div>
                      <div className="art-corner">
                        <Workflow size={23} />
                      </div>
                    </div>
                  </section>
                  <section className="section-block">
                    <div className="section-heading">
                      <h2>
                        最近阅读{" "}
                        <span className="sub-count">{papers.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => navigate("library")}
                      >
                        查看论文库 <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="panel recent-panel">
                      {loading ? (
                        <div className="loading-state">
                          <Loader2 className="spin" />
                          正在打开论文库
                        </div>
                      ) : papers.length ? (
                        papers.slice(0, 4).map((p) => (
                          <button
                            className="recent-row"
                            key={p.id}
                            onClick={() => open(p)}
                          >
                            <span className="paper-icon">
                              <FileText size={20} />
                            </span>
                            <div>
                              <strong>{p.title}</strong>
                              <p>
                                {p.authors.slice(0, 2).join(", ") ||
                                  "作者待补充"}{" "}
                                · {p.year || "年份待补充"}
                              </p>
                            </div>
                            <Pill
                              tone={
                                p.status === "analyzed" ? "green" : "neutral"
                              }
                            >
                              {STATUS[p.status]}
                            </Pill>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <div className="recent-empty">
                          <div className="stack-icon">
                            <FileText size={26} />
                          </div>
                          <div>
                            <strong>这里会记录你的阅读轨迹</strong>
                            <p>导入第一篇论文，开始建立研究脉络。</p>
                          </div>
                          <button
                            className="icon-button"
                            onClick={() => showImport()}
                            aria-label="导入第一篇论文"
                          >
                            <ArrowUpRight size={19} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
                <aside className="overview-right">
                  <section className="panel workflow-card">
                    <div className="section-heading">
                      <h3>你的阅读工作流</h3>
                      <Workflow size={18} />
                    </div>
                    <div className="workflow-steps">
                      {[
                        {
                          title: "收集与解析",
                          desc: "导入链接或 PDF，保留原文与页码",
                          done: papers.length > 0,
                        },
                        {
                          title: "理解技术路线",
                          desc: "Codex 调用 Skill，分析方法与证据",
                          done: counts.analyzed > 0,
                        },
                        {
                          title: "比较与连接",
                          desc: "对照相似论文，找到差异与启发",
                          done: comparisons.length > 0,
                        },
                        {
                          title: "分类与积累",
                          desc: "沉淀为可以持续迁移的知识库",
                          done: counts.tags > 0,
                        },
                      ].map((s, i) => (
                        <div className="workflow-step" key={s.title}>
                          <span className={s.done ? "done" : ""}>
                            {s.done ? (
                              <Check size={13} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <div>
                            <strong>{s.title}</strong>
                            <p>{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="workflow-link"
                      onClick={() => navigate("skill")}
                    >
                      了解 Skill 如何工作 <ArrowUpRight size={14} />
                    </button>
                  </section>
                  <section className="field-note">
                    <span className="eyebrow">FIELD NOTE / 001</span>
                    <h3>
                      不止知道论文说了什么，
                      <br />
                      也理解它为什么有效。
                    </h3>
                    <p>每一项结论，回到方法、实验与原文。</p>
                    <div className="field-mark">
                      <span />
                      <span />
                      <span />
                      <ArrowUpRight size={20} />
                    </div>
                  </section>
                </aside>
              </div>
              <section className="section-block">
                <div className="section-heading">
                  <h2>研究起点</h2>
                  <span className="muted">
                    公开论文 · 点击后导入，不计入个人收藏
                  </span>
                </div>
                <div className="starter-grid">
                  {STARTERS.map((s, i) => (
                    <button
                      className={"starter-card " + s.color}
                      key={s.name}
                      onClick={() => showImport(s.url)}
                    >
                      <div className="starter-top">
                        <span className="starter-number">0{i + 1}</span>
                        <Pill>{s.tag}</Pill>
                        <ArrowUpRight size={18} />
                      </div>
                      <h3>{s.name}</h3>
                      <p>{s.description}</p>
                      <div className="starter-footer">
                        {s.year} <span>arXiv</span>
                        <span>
                          导入阅读 <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                  <button
                    className="starter-card custom-starter"
                    onClick={() => {
                      setView("library");
                      setWebQuery("bimanual manipulation");
                    }}
                  >
                    <div className="starter-top">
                      <Search size={24} />
                      <ArrowUpRight size={18} />
                    </div>
                    <h3>找到你的下一篇论文</h3>
                    <p>按研究问题检索，沿着技术路线拓展。</p>
                    <div className="starter-footer">
                      论文发现{" "}
                      <span>
                        检索 arXiv <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                </div>
              </section>
            </>
          )}
          {view === "library" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR PAPER COLLECTION</div>
                  <h1>
                    我的论文库
                    <span className="heading-count">{papers.length}</span>
                  </h1>
                  <p>把收藏变成理解，把理解连接成知识。</p>
                </div>
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={exportLibrary}
                >
                  <ArrowDownToLine size={16} />
                  导出知识库
                </button>
              </div>
              <div className="library-toolbar">
                <div className="segmented">
                  {[
                    ["all", "全部论文"],
                    ["unread", "待读"],
                    ["parsed", "已解析"],
                    ["queued", "待精读"],
                    ["analyzed", "已精读"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={filter === v ? "selected" : ""}
                      onClick={() => setFilter(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="筛选分类标签"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">全部标签</option>
                  {[...new Set(papers.flatMap((p) => p.tags))].map((t) => (
                    <option key={t} value={t}>
                      {TAG_LABELS[t] || t}
                    </option>
                  ))}
                  {tag && !papers.some((p) => p.tags.includes(tag)) && (
                    <option value={tag}>{TAG_LABELS[tag] || tag}</option>
                  )}
                </select>
              </div>
              {selected.length > 0 && (
                <div className="selection-bar">
                  已选 {selected.length} 篇
                  <button
                    className="text-button"
                    onClick={() => navigate("compare")}
                  >
                    开始对比 <ArrowRight size={14} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setSelected([])}
                  >
                    清空
                  </button>
                </div>
              )}
              <div className="panel paper-table">
                <div className="table-head">
                  <span>论文 / 作者</span>
                  <span>研究标签</span>
                  <span>阅读状态</span>
                  <span>操作</span>
                </div>
                {loading ? (
                  <div className="loading-state">
                    <Loader2 className="spin" />
                    加载中
                  </div>
                ) : filtered.length ? (
                  filtered.map((p) => (
                    <div className="table-row" key={p.id}>
                      <div className="paper-cell">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          aria-label={"选择 " + p.title}
                        />
                        <span className="paper-icon">
                          <FileText size={19} />
                        </span>
                        <button onClick={() => open(p)}>
                          <strong>{p.title}</strong>
                          <small>
                            {p.authors.slice(0, 2).join(", ") || "作者待补充"} ·{" "}
                            {p.year || "年份未知"}
                          </small>
                        </button>
                      </div>
                      <div className="tag-stack">
                        {p.tags.slice(0, 2).map((t) => (
                          <Pill key={t}>{TAG_LABELS[t] || t}</Pill>
                        ))}
                        {!p.tags.length && (
                          <span className="muted">待分类</span>
                        )}
                      </div>
                      <div>
                        <Pill
                          tone={
                            p.status === "analyzed"
                              ? "green"
                              : p.status === "queued"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {STATUS[p.status]}
                        </Pill>
                        <small className="cell-evidence">
                          {EVIDENCE[p.evidenceLevel]}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={"打开 " + p.title}
                        onClick={() => open(p)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty
                    title={
                      papers.length
                        ? "没有匹配的论文"
                        : "你的第一篇论文，会从这里开始"
                    }
                    description={
                      papers.length
                        ? "换一个关键词或分类试试。"
                        : "导入论文链接或本地 PDF，建立属于你的研究集合。"
                    }
                    action={
                      <button
                        className="button primary"
                        onClick={() => showImport()}
                      >
                        <Plus size={16} />
                        导入论文
                      </button>
                    }
                  />
                )}
              </div>
              <section className="panel discovery">
                <div>
                  <div className="eyebrow">DISCOVER MORE</div>
                  <h2>围绕问题，发现相关研究</h2>
                  <p>实时检索 arXiv；搜索结果为摘要与元数据。</p>
                </div>
                <form
                  className="discovery-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchWeb();
                  }}
                >
                  <Search size={18} />
                  <input
                    placeholder="例如：bimanual manipulation / model predictive control"
                    value={webQuery}
                    onChange={(e) => setWebQuery(e.target.value)}
                  />
                  <button
                    className="button primary"
                    disabled={!!busy || !webQuery.trim()}
                  >
                    检索论文
                  </button>
                </form>
                {webError && <div className="notice error">{webError}</div>}
                {webResults.map((p) => (
                  <div className="web-result" key={p.url}>
                    <div>
                      <h3>{p.title}</h3>
                      <p>
                        {p.authors.slice(0, 3).join(", ")} · {p.year}
                      </p>
                      <details>
                        <summary>查看摘要</summary>
                        <p>{p.abstract}</p>
                      </details>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => showImport(p.url)}
                    >
                      <Plus size={15} />
                      导入
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}
          {view === "reader" &&
            (!paper ? (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">READ. UNDERSTAND. CONNECT.</div>
                    <h1>阅读工作台</h1>
                    <p>原文与思考并排，让每个结论都有迹可循。</p>
                  </div>
                </div>
                <div className="panel">
                  <Empty
                    icon={FileText}
                    title="选择一篇论文，开始深入阅读"
                    description="从论文库打开，或导入新的论文。"
                    action={
                      <div className="button-row">
                        <button
                          className="button primary"
                          onClick={() => showImport()}
                        >
                          导入论文
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => navigate("library")}
                        >
                          打开论文库
                        </button>
                      </div>
                    }
                  />
                  {papers.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      className="recent-row"
                      onClick={() => open(p)}
                    >
                      <FileText size={20} />
                      <div>
                        <strong>{p.title}</strong>
                        <p>{STATUS[p.status]}</p>
                      </div>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="reader-heading">
                  <button
                    className="icon-button"
                    aria-label="返回论文库"
                    onClick={() => navigate("library")}
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <div>
                    <h1>{paper.title}</h1>
                    <p>
                      {paper.authors.slice(0, 3).join(", ") || "作者待补充"} ·{" "}
                      {paper.year || "年份待补充"}{" "}
                      <Pill tone="green">{EVIDENCE[paper.evidenceLevel]}</Pill>
                    </p>
                  </div>
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => queue(paper)}
                  >
                    <Sparkles size={16} />
                    {paper.analysis ? "重新精读" : "交给 Codex 精读"}
                  </button>
                </div>
                <div className="reader-grid">
                  <section className="panel source-pane">
                    <div className="pane-toolbar">
                      <div className="mini-tabs">
                        <button
                          className={pageTab === "pdf" ? "active" : ""}
                          onClick={() => setPageTab("pdf")}
                        >
                          论文原文
                        </button>
                        <button
                          className={pageTab === "text" ? "active" : ""}
                          onClick={() => setPageTab("text")}
                        >
                          解析文本 <span>{pages.length}</span>
                        </button>
                      </div>
                      {paper.url && (
                        <a
                          className="icon-button"
                          href={paper.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="打开论文来源"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    {readerError && (
                      <div className="notice error">{readerError}</div>
                    )}
                    {paper.parsingWarning && (
                      <div className="notice">{paper.parsingWarning}</div>
                    )}
                    {pageTab === "pdf" ? (
                      paper.hasPdf ? (
                        <PaperPDF id={paper.id} />
                      ) : (
                        <Empty
                          icon={FileText}
                          title="论文原文尚未上传"
                          description={
                            paper.abstract
                              ? "已取得论文摘要。添加原文后，可按页阅读和精读。"
                              : "添加 PDF，或在来源页面查看全文。"
                          }
                          action={
                            <button
                              className="button secondary"
                              onClick={() => {
                                showImport();
                                setAttachId(paper.id);
                                setImportMode("file");
                              }}
                            >
                              <Upload size={16} />
                              添加论文原文
                            </button>
                          }
                        />
                      )
                    ) : pages.length ? (
                      <div className="parsed-view">
                        <div className="page-controls">
                          <button
                            disabled={pageNum === 1}
                            onClick={() => setPageNum((p) => p - 1)}
                          >
                            <ArrowLeft size={15} />
                          </button>
                          <span>
                            第 {pageNum} / {pages.length} 页
                          </span>
                          <button
                            disabled={pageNum === pages.length}
                            onClick={() => setPageNum((p) => p + 1)}
                          >
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        <p className="text-warning">
                          机器提取文本 · 公式与表格请对照原文
                        </p>
                        <pre>
                          {pages[pageNum - 1]?.text ||
                            "本页未提取到文字，可能为图片页。"}
                        </pre>
                      </div>
                    ) : (
                      <Empty
                        title="尚未解析全文"
                        description={
                          paper.abstract || "先添加 PDF，再提取逐页文本。"
                        }
                        action={
                          paper.hasPdf ? (
                            <button
                              className="button primary"
                              disabled={!!busy}
                              onClick={async () => {
                                try {
                                  await parseSaved(paper);
                                  await refresh();
                                } catch (e) {
                                  notify((e as Error).message);
                                } finally {
                                  setBusy("");
                                }
                              }}
                            >
                              解析 PDF
                            </button>
                          ) : undefined
                        }
                      />
                    )}
                  </section>
                  <section className="panel analysis-pane">
                    <div className="pane-toolbar">
                      <div className="mini-tabs">
                        {[
                          ["overview", "阅读概览"],
                          ["method", "技术路线"],
                          ["evidence", "实验证据"],
                          ["notes", "我的笔记"],
                        ].map(([v, l]) => (
                          <button
                            key={v}
                            className={analysisTab === v ? "active" : ""}
                            onClick={() => setAnalysisTab(v)}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="analysis-body">
                      {analysisTab === "notes" ? (
                        <>
                          <div className="section-heading">
                            <h3>我的思考与批注</h3>
                            <button
                              className="button primary small-button"
                              disabled={!!busy}
                              onClick={saveNote}
                            >
                              保存笔记
                            </button>
                          </div>
                          <p className="muted">
                            独立保存，AI 更新分析时会保留。
                          </p>
                          <textarea
                            className="notes-editor"
                            placeholder="记录问题、想法，以及与你的研究有关的细节…"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <div className="section-heading">
                            <h3>分类标签</h3>
                          </div>
                          {Object.entries(TAG_GROUPS).map(([name, tags]) => (
                            <div className="tag-picker" key={name}>
                              <small>{name}</small>
                              <div>
                                {tags.map((t) => (
                                  <button
                                    className={
                                      paper.tags.includes(t) ? "chosen" : ""
                                    }
                                    key={t}
                                    onClick={() => editTags(paper, t)}
                                  >
                                    {TAG_LABELS[t] || t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : paper.analysis ? (
                        <>
                          {analysisTab === "overview" ? (
                            <>
                              <div className="analysis-badge">
                                <Sparkles size={14} /> Codex 阅读分析{" "}
                                <span>
                                  {EVIDENCE[paper.analysis.evidenceLevel]}
                                </span>
                              </div>
                              <h2>一分钟理解</h2>
                              <p className="analysis-summary">
                                {paper.analysis.summary}
                              </p>
                              <h3>研究问题</h3>
                              <p>{paper.analysis.problem}</p>
                              <h3>关键贡献</h3>
                              <ul>
                                {paper.analysis.contributions.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                              <h3>局限与边界</h3>
                              <ul>
                                {paper.analysis.limitations.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                              <details className="full-report">
                                <summary>展开完整精读报告</summary>
                                <Rich text={paper.analysis.markdown} />
                              </details>
                              <button
                                className="button secondary"
                                onClick={() =>
                                  download(
                                    paper.title + ".md",
                                    paper.analysis!.markdown,
                                    "text/markdown",
                                  )
                                }
                              >
                                导出阅读报告 <ArrowDownToLine size={14} />
                              </button>
                            </>
                          ) : analysisTab === "method" ? (
                            <>
                              <div className="eyebrow">METHOD AT A GLANCE</div>
                              <h2>从输入，到动作</h2>
                              <div className="pipeline">
                                {paper.analysis.pipeline.map((s, i) => (
                                  <div key={i}>
                                    <span>{i + 1}</span>
                                    <section>
                                      <h3>{s.label}</h3>
                                      <p>{s.detail}</p>
                                      <small>{s.source}</small>
                                    </section>
                                  </div>
                                ))}
                              </div>
                              <h3>训练 / 求解</h3>
                              <p>{paper.analysis.training}</p>
                              <h3>部署 / 控制闭环</h3>
                              <p>{paper.analysis.inference}</p>
                            </>
                          ) : (
                            <>
                              <h2>结论背后的实验</h2>
                              {paper.analysis.experiments.map((e, i) => (
                                <div className="evidence-card" key={i}>
                                  <strong>{e.claim}</strong>
                                  <p>{e.result}</p>
                                  <small>实验条件：{e.conditions}</small>
                                  <small>原文定位：{e.source}</small>
                                </div>
                              ))}
                              <h3>来源与证据</h3>
                              {paper.analysis.sources.map((s, i) => (
                                <div className="source-item" key={i}>
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {s.locator} <ArrowUpRight size={12} />
                                  </a>
                                  <small>
                                    {s.kind} · {s.accessed}
                                  </small>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      ) : (
                        <div className="analysis-empty">
                          <div className="large-spark">
                            <Sparkles size={28} />
                          </div>
                          <Pill tone="green">已准备好阅读材料</Pill>
                          <h2>
                            读懂方法，
                            <br />
                            也读懂方法的边界。
                          </h2>
                          <p>
                            交给你的 Codex 阅读
                            Skill，获得有原文依据的技术路线、实验分析与相似工作比较。
                          </p>
                          <div className="reading-checklist">
                            {[
                              "研究问题与关键贡献",
                              "训练与部署技术路线",
                              "实验依据与失败模式",
                              "相似论文比较与分类",
                            ].map((t) => (
                              <span key={t}>
                                <Check size={14} />
                                {t}
                              </span>
                            ))}
                          </div>
                          <button
                            className="button primary"
                            disabled={!!busy}
                            onClick={() => queue(paper)}
                          >
                            <Sparkles size={16} />
                            创建精读任务并复制指令
                          </button>
                          <p className="small-note">
                            粘贴指令到 Codex 后开始阅读。结果写回后自动显示。
                          </p>
                          {paper.abstract && (
                            <details className="abstract-details">
                              <summary>先阅读论文摘要</summary>
                              <p>{paper.abstract}</p>
                            </details>
                          )}
                        </div>
                      )}
                      {related.length > 0 && (
                        <div className="related">
                          <h3>库内相关论文</h3>
                          {related.map((x) => (
                            <button
                              key={x.paper.id}
                              onClick={() => open(x.paper)}
                            >
                              {x.paper.title}
                              <ArrowUpRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ))}
          {view === "compare" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">COMPARE WITH CONTEXT</div>
                  <h1>比较方法，也比较条件。</h1>
                  <p>
                    选择 2–4
                    篇论文，梳理技术差异。不同实验协议下的数字不直接排名。
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => navigate("library")}
                >
                  <Plus size={16} />
                  选择论文
                </button>
              </div>
              <div className="compare-select">
                {papers.map((p) => (
                  <button
                    className={selected.includes(p.id) ? "chosen" : ""}
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                  >
                    {selected.includes(p.id) ? (
                      <Check size={14} />
                    ) : (
                      <Plus size={14} />
                    )}{" "}
                    {p.title}
                  </button>
                ))}
              </div>
              {selected.length >= 2 ? (
                <>
                  <div className="panel comparison-table-wrap">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>对比维度</th>
                          {selected.map((id) => (
                            <th key={id}>
                              {papers.find((p) => p.id === id)?.title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "研究标签",
                            (p: Paper) =>
                              p.tags
                                .map((t) => TAG_LABELS[t] || t)
                                .join(" / ") || "待分类",
                          ],
                          ["证据等级", (p: Paper) => EVIDENCE[p.evidenceLevel]],
                          [
                            "研究问题",
                            (p: Paper) => p.analysis?.problem || "尚未精读",
                          ],
                          [
                            "核心思路",
                            (p: Paper) => p.analysis?.summary || "尚未精读",
                          ],
                          [
                            "训练 / 数据",
                            (p: Paper) => p.analysis?.training || "未验证",
                          ],
                          [
                            "部署 / 控制",
                            (p: Paper) => p.analysis?.inference || "未验证",
                          ],
                          [
                            "局限",
                            (p: Paper) =>
                              p.analysis?.limitations.join("\n") || "未验证",
                          ],
                        ].map(([label, get]) => (
                          <tr key={String(label)}>
                            <th>{String(label)}</th>
                            {selected.map((id) => {
                              const p = papers.find((p) => p.id === id);
                              return (
                                <td key={id}>
                                  {p
                                    ? (get as (p: Paper) => string)(p)
                                    : "论文已移除"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="compare-footer">
                    <p>
                      <ShieldCheck size={16} />
                      先对齐数据、机器人与评测条件，再讨论方法优劣。
                    </p>
                    <button
                      className="button primary"
                      onClick={() =>
                        copy(comparisonPrompt(location.origin, selected))
                      }
                    >
                      <Copy size={15} />
                      复制 Codex 对比指令
                    </button>
                  </div>
                </>
              ) : (
                <div className="panel">
                  <Empty
                    icon={GitCompareArrows}
                    title="让论文之间建立联系"
                    description="从论文库中选择至少两篇论文，生成并排比较。"
                    action={
                      <button
                        className="button primary"
                        onClick={() => navigate("library")}
                      >
                        去论文库选择 <ArrowRight size={15} />
                      </button>
                    }
                  />
                </div>
              )}
              <section className="section-block">
                <div className="section-heading">
                  <h2>已保存的对比报告</h2>
                  <button className="text-button" onClick={() => refresh()}>
                    刷新结果
                  </button>
                </div>
                {comparisons.length ? (
                  <div className="panel saved-comparisons">
                    {comparisons.map((c) => (
                      <details
                        key={c.id}
                        open={compareId === c.id}
                        onToggle={(e) => {
                          if (e.currentTarget.open) setCompareId(c.id);
                        }}
                      >
                        <summary>
                          {c.title}
                          <span>
                            {new Date(c.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                        </summary>
                        <Rich text={c.markdown} />
                        <button
                          className="button secondary"
                          onClick={() =>
                            download(
                              c.title + ".md",
                              c.markdown,
                              "text/markdown",
                            )
                          }
                        >
                          导出报告
                        </button>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Codex 完成对比并保存后，报告会显示在这里。
                  </p>
                )}
              </section>
            </>
          )}
          {view === "topics" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A MAP OF YOUR RESEARCH</div>
                  <h1>用多个视角，连接知识。</h1>
                  <p>
                    一篇论文可以属于多个研究方向。分类不会复制论文或拆散笔记。
                  </p>
                </div>
              </div>
              {Object.entries(TAG_GROUPS).map(([name, tags], group) => (
                <section className="section-block" key={name}>
                  <div className="section-heading">
                    <h2>
                      <span className="group-number">0{group + 1}</span>
                      {name}
                    </h2>
                  </div>
                  <div className="topic-grid">
                    {tags.map((t, i) => {
                      const count = papers.filter((p) =>
                        p.tags.includes(t),
                      ).length;
                      return (
                        <button
                          key={t}
                          className="topic-card"
                          onClick={() => {
                            setTag(t);
                            setFilter("all");
                            navigate("library");
                          }}
                        >
                          <span className={"topic-icon dot-" + (group % 3)}>
                            <Layers3 size={20} />
                          </span>
                          <h3>{TAG_LABELS[t] || t}</h3>
                          <p>{t}</p>
                          <div>
                            <span>{count} 篇论文</span>
                            <ArrowUpRight size={17} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          )}
          {view === "skill" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">BUILT TO KEEP LEARNING</div>
                  <h1>你的研究能力，可以随身带走。</h1>
                  <p>网站保存知识，Skill 组织阅读。两者独立，也彼此连接。</p>
                </div>
                <a
                  className="button primary"
                  href="/downloads/robotics-paper-workbench.zip"
                  download
                >
                  <ArrowDownToLine size={16} />
                  下载阅读 Skill
                </a>
              </div>
              <div className="skill-page-grid">
                <section className="panel skill-feature">
                  <div className="skill-feature-top">
                    <Mark />
                    <Pill tone="green">robotics-paper-workbench</Pill>
                  </div>
                  <h2>从论文，到真正的理解。</h2>
                  <p>
                    一个适用于机器人、具身智能、运动规划与控制的阅读工作流。默认中文解释，保留英文术语，关键结论始终回到原文。
                  </p>
                  <div className="skill-capabilities">
                    {[
                      [
                        "框架拆解",
                        "问题 → 输入 → 模型 / 规划 / 控制 → 动作 → 反馈",
                      ],
                      [
                        "证据分析",
                        "区分作者主张、实验结果、读者推断与未报告项",
                      ],
                      ["相似工作", "从任务、机制、动作接口和实验条件进行对比"],
                      ["持续积累", "多维分类、保留笔记、可导出和迁移"],
                    ].map(([t, d]) => (
                      <div key={t}>
                        <Check size={15} />
                        <span>
                          <strong>{t}</strong>
                          <small>{d}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel connection-guide">
                  <div className="section-heading">
                    <h3>如何连接 Codex</h3>
                    <Sparkles size={19} />
                  </div>
                  <ol>
                    <li>
                      <strong>导入论文</strong>
                      <p>上传 PDF 或粘贴论文链接，等待文本解析。</p>
                    </li>
                    <li>
                      <strong>创建精读任务</strong>
                      <p>
                        在阅读工作台点击「交给 Codex 精读」，复制生成的指令。
                      </p>
                    </li>
                    <li>
                      <strong>在 Codex 中运行 Skill</strong>
                      <p>
                        连接此网站的个人插件并粘贴指令。Skill
                        会读取原文、完成分析并写回。
                      </p>
                    </li>
                  </ol>
                  <div className="notice">
                    插件在网站发布时提供。若 Codex 尚未显示论文工具，在「插件 →
                    个人 → 由你创建」连接本网站插件，然后打开新对话。
                  </div>
                  <p className="muted">
                    网站不单独调用付费模型 API；提交任务后，需要你在 Codex
                    发起阅读。
                  </p>
                </section>
              </div>
              <section className="panel migration-panel">
                <div>
                  <div className="eyebrow">YOUR KNOWLEDGE, YOUR FILES</div>
                  <h2>知识可以搬家，积累不必重来。</h2>
                  <p>
                    导出原始 PDF、逐页文本、元数据、Markdown 笔记和比较报告。
                    <br />
                    在另一个工作台中导入备份包，或交给本地 Skill 继续研究。
                  </p>
                </div>
                <div className="migration-actions">
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={exportLibrary}
                  >
                    <ArrowDownToLine size={16} />
                    导出完整知识库
                  </button>
                  <button
                    className="button secondary"
                    disabled={!!busy}
                    onClick={() => archiveInput.current?.click()}
                  >
                    <Upload size={16} />
                    导入知识库备份
                  </button>
                  <input
                    hidden
                    ref={archiveInput}
                    type="file"
                    accept=".zip"
                    onChange={(e) => {
                      if (e.target.files?.[0]) importArchive(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </section>
              <section className="panel principles">
                <h3>把证据边界，一起保存。</h3>
                <div>
                  <span>
                    <ShieldCheck size={19} />
                    私人论文与文件按账户隔离
                  </span>
                  <span>
                    <BookOpen size={19} />
                    只有原文支持才标为全文精读
                  </span>
                  <span>
                    <FileText size={19} />
                    扫描件提示 OCR，保留真实缺口
                  </span>
                </div>
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              <Mark small /> embodied · 为理解而读，为研究而积累。
            </span>
            <span>ROBOTICS / EMBODIED AI / CONTROL</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            className="import-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">ADD TO YOUR KNOWLEDGE</span>
                <h2 id="import-title">导入一篇论文</h2>
              </div>
              <button
                className="icon-button"
                aria-label="关闭导入"
                disabled={!!busy}
                onClick={() => setModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            {!attachId && (
              <div className="segmented import-tabs">
                <button
                  className={importMode === "url" ? "selected" : ""}
                  onClick={() => {
                    setImportMode("url");
                    setMeta(null);
                    setTitle("");
                  }}
                >
                  <Link2 size={16} />
                  论文链接
                </button>
                <button
                  className={importMode === "file" ? "selected" : ""}
                  onClick={() => {
                    setImportMode("file");
                    setMeta(null);
                    setTitle("");
                  }}
                >
                  <Upload size={16} />
                  本地 PDF
                </button>
              </div>
            )}
            {importMode === "url" ? (
              <>
                <label className="field-label" htmlFor="paper-link">
                  arXiv、DOI 或论文链接
                </label>
                <div className="url-input">
                  <Link2 size={17} />
                  <input
                    id="paper-link"
                    autoFocus
                    placeholder="https://arxiv.org/abs/…"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setMeta(null);
                    }}
                  />
                  <button onClick={resolve} disabled={!link || !!busy}>
                    获取信息
                  </button>
                </div>
                <p className="input-hint">
                  支持论文页面与 PDF 链接。受限全文可通过本地上传添加。
                </p>
              </>
            ) : (
              <div
                className={"dropzone " + (file ? "has-file" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) {
                    setFile(f);
                    setTitle(f.name.replace(/\.pdf$/i, ""));
                  }
                }}
              >
                <Upload size={27} />
                <strong>{file ? file.name : "将 PDF 拖到这里"}</strong>
                <p>
                  {file
                    ? (file.size / 1024 / 1024).toFixed(1) + " MB"
                    : "或从电脑中选择文件，最大 25 MB"}
                </p>
                <button
                  className="button secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  {file ? "更换文件" : "选择 PDF 文件"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setTitle(f.name.replace(/\.pdf$/i, ""));
                    }
                  }}
                />
              </div>
            )}
            {(meta || file) && (
              <div className="metadata-preview">
                <label className="field-label" htmlFor="paper-title">
                  论文标题
                </label>
                <input
                  id="paper-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {meta?.authors?.length > 0 && (
                  <p>
                    {meta.authors.slice(0, 4).join(", ")} ·{" "}
                    {meta.year || "年份未知"}
                  </p>
                )}
                {meta?.abstract && (
                  <p className="preview-abstract">{meta.abstract}</p>
                )}
                {meta?.notice && <div className="notice">{meta.notice}</div>}
              </div>
            )}
            {importError && <div className="notice error">{importError}</div>}
            <div className="modal-footer">
              <span>
                <ShieldCheck size={14} />
                保存到你的私人论文库
              </span>
              <button
                className="button primary"
                disabled={
                  !!busy ||
                  (importMode === "file" && !file) ||
                  (importMode === "url" && !link)
                }
                onClick={importCurrent}
              >
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                导入并解析
              </button>
            </div>
          </section>
        </div>
      )}
      {taskPrompt && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-title"
            className="import-modal"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">CONTINUE IN CODEX</span>
                <h2 id="prompt-title">在 Codex 中开始阅读</h2>
              </div>
              <button
                className="icon-button"
                aria-label="关闭阅读指令"
                onClick={() => setTaskPrompt("")}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              复制下面的指令，粘贴到已连接本网站插件的 Codex
              对话。完成分析后，结果会写回工作台。
            </p>
            <textarea
              className="notes-editor prompt-editor"
              aria-label="Codex 阅读指令"
              readOnly
              value={taskPrompt}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="modal-footer">
              <button
                className="button secondary"
                onClick={() => {
                  setTaskPrompt("");
                  navigate("skill");
                }}
              >
                查看连接说明
              </button>
              <button
                className="button primary"
                onClick={() => copy(taskPrompt)}
              >
                <Copy size={16} />
                复制指令
              </button>
            </div>
          </section>
        </div>
      )}
      {busy && (
        <div className="progress-toast" role="status">
          <Loader2 className="spin" size={18} />
          {busy}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
