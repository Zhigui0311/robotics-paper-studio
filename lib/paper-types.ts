export type PaperPage = { page: number; text: string };
export type Evidence = "metadata" | "abstract" | "fulltext" | "fulltext+code";
export type PaperStatus = "unread" | "parsed" | "queued" | "analyzed";
export type Source = {
  url: string;
  kind: string;
  locator: string;
  accessed: string;
};
export type Analysis = {
  summary: string;
  problem: string;
  contributions: string[];
  pipeline: { label: string; detail: string; source: string }[];
  training: string;
  inference: string;
  experiments: {
    claim: string;
    result: string;
    conditions: string;
    source: string;
  }[];
  limitations: string[];
  markdown: string;
  evidenceLevel: Evidence;
  sources: Source[];
  updatedAt?: string;
};
export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  url: string;
  doi: string;
  arxiv: string;
  abstract: string;
  tags: string[];
  status: PaperStatus;
  evidenceLevel: Evidence;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  textChars: number;
  hasPdf: boolean;
  fileName: string;
  parsingWarning: string;
  userNotes: string;
  analysis: Analysis | null;
  readingScope: string;
  sources: Source[];
};
export type Comparison = {
  id: string;
  title: string;
  paperIds: string[];
  markdown: string;
  createdAt: string;
};
export const STATUS: Record<PaperStatus, string> = {
  unread: "待读",
  parsed: "已解析",
  queued: "待精读",
  analyzed: "已精读",
};
export const EVIDENCE: Record<Evidence, string> = {
  metadata: "元数据",
  abstract: "摘要级",
  fulltext: "全文级",
  "fulltext+code": "全文与代码",
};
export const TAG_GROUPS: Record<string, string[]> = {
  研究任务: [
    "manipulation",
    "bimanual-manipulation",
    "deformable-manipulation",
    "locomotion",
    "navigation",
  ],
  技术方法: [
    "imitation-learning",
    "diffusion-policy",
    "action-chunking",
    "reinforcement-learning",
    "vla",
    "mpc",
    "whole-body-control",
  ],
  机器人形态: [
    "single-arm",
    "dual-arm",
    "humanoid",
    "quadruped",
    "dexterous-hand",
  ],
  验证方式: ["real-robot", "simulation", "sim-to-real", "theoretical"],
};
export const TAG_LABELS: Record<string, string> = {
  manipulation: "机器人操作",
  "bimanual-manipulation": "双臂操作",
  "deformable-manipulation": "柔性物体",
  locomotion: "运动控制",
  navigation: "导航",
  "imitation-learning": "模仿学习",
  "diffusion-policy": "扩散策略",
  "action-chunking": "动作分块",
  "reinforcement-learning": "强化学习",
  vla: "视觉语言动作",
  mpc: "模型预测控制",
  "whole-body-control": "全身控制",
  "single-arm": "单臂",
  "dual-arm": "双臂",
  humanoid: "人形机器人",
  quadruped: "四足机器人",
  "dexterous-hand": "灵巧手",
  "real-robot": "真机验证",
  simulation: "仿真",
  "sim-to-real": "仿真到现实",
  theoretical: "理论分析",
};
