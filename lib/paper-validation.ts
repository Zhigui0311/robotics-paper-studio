import { z } from 'zod';
export const pageSchema = z.object({page:z.number().int().min(1).max(400),text:z.string().max(100000)});
export const sourceSchema = z.object({url:z.string().min(1).max(2000).refine(v=>/^https?:\/\//.test(v)||/^attachments\/[a-zA-Z0-9._-]+$/.test(v),'来源需为网页地址或附件路径'),kind:z.enum(['metadata','abstract','fulltext','code']),locator:z.string().min(1).max(500),accessed:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export const evidenceSchema = z.enum(['metadata','abstract','fulltext','fulltext+code']);
export const analysisSchema = z.object({
  summary:z.string().min(1).max(10000),problem:z.string().max(12000),
  contributions:z.array(z.string().max(5000)).max(15),
  pipeline:z.array(z.object({label:z.string().max(120),detail:z.string().max(4000),source:z.string().min(1).max(2000)})).max(20),
  training:z.string().max(12000),inference:z.string().max(12000),
  experiments:z.array(z.object({claim:z.string().max(5000),result:z.string().max(5000),conditions:z.string().max(5000),source:z.string().min(1).max(2000)})).max(40),
  limitations:z.array(z.string().max(5000)).max(25),markdown:z.string().min(20).max(150000),
  evidenceLevel:evidenceSchema,sources:z.array(sourceSchema).min(1).max(40),
}).superRefine((a,ctx)=>{
  if(a.evidenceLevel==='abstract'&&!a.sources.some(s=>s.kind==='abstract'||s.kind==='fulltext'))ctx.addIssue({code:'custom',message:'摘要分析需要摘要来源'});
  if(a.evidenceLevel.startsWith('fulltext')&&!a.sources.some(s=>s.kind==='fulltext'))ctx.addIssue({code:'custom',message:'全文分析需要原文来源与章节定位'});
  if(a.evidenceLevel==='fulltext+code'&&!a.sources.some(s=>s.kind==='code'))ctx.addIssue({code:'custom',message:'代码分析需要代码来源'});
});
export const importSchema=z.object({
 title:z.string().min(1).max(1000),authors:z.array(z.string().max(200)).max(100).default([]),
 year:z.number().int().min(1900).max(2200).nullable().default(null),venue:z.string().max(500).default(''),
 url:z.string().max(2000).default(''),doi:z.string().max(300).default(''),arxiv:z.string().max(100).default(''),
 abstract:z.string().max(30000).default(''),tags:z.array(z.string().min(1).max(100)).max(30).default([]),
 fileName:z.string().max(300).default(''),readingScope:z.string().max(3000).default(''),
 sources:z.array(sourceSchema).max(40).default([]),
});
export function canonicalIdentity(input:{arxiv?:string;doi?:string;url?:string;title:string}, fileHash?:string) {
  if(input.arxiv) return 'arxiv:'+input.arxiv.replace(/v\d+$/,'');
  if(input.doi) return 'doi:'+input.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').toLowerCase();
  if(fileHash) return 'pdf:'+fileHash;
  if(input.url) { const u=new URL(input.url);u.hash='';return 'url:'+u.href; }
  return 'title:'+input.title.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
}
export function checkedLink(value:string) {
  value=value.trim();if(/^10\.\d{4,9}\//.test(value))value='https://doi.org/'+value;
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)throw new Error('请输入不含账户或端口的 HTTPS 论文链接');
  return u;
}
const hosts=['arxiv.org','export.arxiv.org','openreview.net','proceedings.mlr.press','roboticsproceedings.org','www.roboticsproceedings.org','openaccess.thecvf.com','api.crossref.org'];
export function downloadableURL(value:string) {
  const u=checkedLink(value);
  if(!hosts.includes(u.hostname))throw new Error('这个站点暂不支持自动下载。请下载 PDF 后本地导入；链接仍可收藏。');
  return u;
}
export function similarity(a:{tags:string[];title:string},b:{tags:string[];title:string}) {
  const shared=a.tags.filter(t=>b.tags.includes(t));
  const words=(s:string)=>new Set(s.toLowerCase().match(/[a-z]{3,}/g)||[]);
  const aa=words(a.title),bb=words(b.title);const terms=[...aa].filter(x=>bb.has(x));
  return {score:shared.length*3+terms.length,shared,terms};
}
