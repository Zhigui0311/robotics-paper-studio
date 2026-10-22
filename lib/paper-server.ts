import { env } from 'cloudflare:workers';
import { analysisSchema, canonicalIdentity, checkedLink, downloadableURL, importSchema, pageSchema } from './paper-validation';
import { z } from 'zod';
import type { Analysis, Comparison, Paper, PaperPage } from './paper-types';

const MAX_PDF=25*1024*1024;
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export function bindings(){if(!env.DB||!env.BUCKET)throw new HttpError(503,'知识库暂不可用，请稍后重试');return {db:env.DB,bucket:env.BUCKET}}
export function actor(req:Request){const id=req.headers.get('oai-authenticated-user-id');if(!id)throw new HttpError(401,'请先登录后访问个人论文库');return id}
export function checkOrigin(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)throw new HttpError(403,'请求来源不匹配')}
export async function body(req:Request,max=300000){const value=await req.text();if(value.length>max)throw new HttpError(413,'请求内容过大');return JSON.parse(value)}
export async function listPapers(user:string){const {db}=bindings();const rows=await db.prepare('SELECT record FROM papers WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1000').bind(user).all<{record:string}>();return rows.results.map(r=>JSON.parse(r.record) as Paper)}
export async function getPaper(user:string,id:string){const {db}=bindings();const row=await db.prepare('SELECT record FROM papers WHERE id = ? AND user_id = ?').bind(id,user).first<{record:string}>();if(!row)throw new HttpError(404,'没有找到这篇论文');return JSON.parse(row.record) as Paper}
export async function persist(user:string,p:Paper){p.updatedAt=new Date().toISOString();await bindings().db.prepare('UPDATE papers SET record = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(p),p.updatedAt,p.id,user).run();return p}
export async function getPages(user:string,id:string){await getPaper(user,id);const item=await bindings().bucket.get(`${user}/${id}/text.json`);return item?await item.json<PaperPage[]>():[]}
export async function importPaper(user:string,raw:unknown,pdf?:ArrayBuffer){
 const input=importSchema.parse(raw);if(input.url)checkedLink(input.url);
 if(pdf){if(pdf.byteLength>MAX_PDF)throw new HttpError(413,'PDF 超过 25 MB');if(new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-')throw new HttpError(400,'文件不是有效的 PDF');}
 const hash=pdf?[...new Uint8Array(await crypto.subtle.digest('SHA-256',pdf))].map(x=>x.toString(16).padStart(2,'0')).join(''):undefined;
 const fingerprint=canonicalIdentity(input,hash);const {db,bucket}=bindings();
 const previous=await db.prepare('SELECT record FROM papers WHERE user_id = ? AND fingerprint = ?').bind(user,fingerprint).first<{record:string}>();
 if(previous){const p=JSON.parse(previous.record) as Paper;if(pdf&&!p.hasPdf){await bucket.put(`${user}/${p.id}/paper.pdf`,pdf,{httpMetadata:{contentType:'application/pdf'}});p.hasPdf=true;p.fileName=input.fileName;await persist(user,p)}return {paper:p,duplicate:true}}
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const paper:Paper={...input,id,createdAt:now,updatedAt:now,status:'unread',evidenceLevel:input.abstract?'abstract':'metadata',pageCount:0,textChars:0,hasPdf:!!pdf,userNotes:'',parsingWarning:'',analysis:null};
 if(pdf)await bucket.put(`${user}/${id}/paper.pdf`,pdf,{httpMetadata:{contentType:'application/pdf'}});
 try{await db.prepare('INSERT INTO papers (id,user_id,fingerprint,record,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(id,user,fingerprint,JSON.stringify(paper),now,now).run()}
 catch(e){if(pdf)await bucket.delete(`${user}/${id}/paper.pdf`);const race=await db.prepare('SELECT record FROM papers WHERE user_id = ? AND fingerprint = ?').bind(user,fingerprint).first<{record:string}>();if(race)return {paper:JSON.parse(race.record),duplicate:true};throw e}
 return {paper,duplicate:false};
}
export async function savePages(user:string,id:string,raw:unknown){const pages=z.array(pageSchema).min(1).max(400).parse(raw);pages.sort((a,b)=>a.page-b.page);if(pages.some((p,i)=>p.page!==i+1))throw new HttpError(400,'页码必须从 1 开始连续排列');if(JSON.stringify(pages).length>8000000)throw new HttpError(413,'论文文本超过解析上限');const paper=await getPaper(user,id);await bindings().bucket.put(`${user}/${id}/text.json`,JSON.stringify(pages));paper.pageCount=pages.length;paper.textChars=pages.reduce((s,p)=>s+p.text.trim().length,0);paper.parsingWarning=paper.textChars<pages.length*40?'文本较少，可能是扫描件。请上传 OCR 后的 PDF，或让 Codex 查看原文页面。':'';if(paper.status==='unread'&&paper.textChars>0)paper.status='parsed';return persist(user,paper)}
export async function updatePaper(user:string,id:string,raw:unknown){const d=z.object({title:z.string().min(1).max(1000).optional(),tags:z.array(z.string().min(1).max(100)).max(30).optional(),userNotes:z.string().max(100000).optional(),readingScope:z.string().max(3000).optional(),status:z.literal('queued').optional()}).parse(raw);return persist(user,{...await getPaper(user,id),...d})}
export async function saveAnalysis(user:string,id:string,raw:unknown,tags?:string[]){const a=analysisSchema.parse(raw) as Analysis;const p=await getPaper(user,id);const levels=['metadata','abstract','fulltext','fulltext+code'];if(levels.indexOf(a.evidenceLevel)<levels.indexOf(p.analysis?.evidenceLevel||'metadata'))throw new HttpError(409,'已有更完整的分析，请保留已有证据后再更新');if(a.evidenceLevel.startsWith('fulltext')&&p.textChars===0&&!a.sources.some(s=>/^https:\/\//.test(s.url)&&s.kind==='fulltext'))throw new HttpError(400,'缺少可核实的全文证据');const {bucket}=bindings();if(p.analysis)await bucket.put(`${user}/${id}/history/${Date.now()}.json`,JSON.stringify(p.analysis));p.analysis={...a,updatedAt:new Date().toISOString()};p.evidenceLevel=a.evidenceLevel;p.status=a.evidenceLevel.startsWith('fulltext')?'analyzed':'parsed';if(tags)p.tags=z.array(z.string().min(1).max(100)).max(30).parse(tags);return persist(user,p)}
export async function deletePaper(user:string,id:string){await getPaper(user,id);const {db,bucket}=bindings();await db.prepare('DELETE FROM papers WHERE id = ? AND user_id = ?').bind(id,user).run();await bucket.delete([`${user}/${id}/paper.pdf`,`${user}/${id}/text.json`]);return {deleted:true}}
export async function fileResponse(user:string,id:string){const p=await getPaper(user,id);if(!p.hasPdf)throw new HttpError(404,'尚未保存 PDF');const obj=await bindings().bucket.get(`${user}/${id}/paper.pdf`);if(!obj)throw new HttpError(404,'PDF 文件不存在');return new Response(obj.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="paper.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
export async function limitedFetch(url:string,max=MAX_PDF,depth=0):Promise<{data:ArrayBuffer;url:string;type:string}>{
 const u=downloadableURL(url);const response=await fetch(u.href,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'RoboticsPaperStudio/1.0'}});
 if(response.status>=300&&response.status<400){if(depth>=3)throw new HttpError(502,'链接重定向过多');const location=response.headers.get('location');if(!location)throw new HttpError(502,'下载地址无效');return limitedFetch(new URL(location,u).href,max,depth+1)}
 if(!response.ok)throw new HttpError(502,`论文来源返回 ${response.status}，可改用本地 PDF 上传`);
 if(Number(response.headers.get('content-length'))>max)throw new HttpError(413,'来源文件过大');
 const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'来源没有返回内容');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new HttpError(413,'来源内容超过大小限制')}chunks.push(value)}
 const out=new Uint8Array(size);let pos=0;for(const c of chunks){out.set(c,pos);pos+=c.length}return {data:out.buffer,url:u.href,type:response.headers.get('content-type')||''};
}
function decode(s:string){return s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}
function meta(html:string,name:string){const all=[...html.matchAll(/<meta\s+[^>]*>/gi)];return all.filter(x=>new RegExp(`(?:name|property)=["']${name}["']`,'i').test(x[0])).map(x=>decode(x[0].match(/content=(["'])(.*?)\1/i)?.[2]||''))}
export async function resolveLink(value:string){
 const u=checkedLink(value),today=new Date().toISOString().slice(0,10);
 const blank={title:u.hostname,authors:[] as string[],year:null as number|null,venue:'',url:u.href,doi:'',arxiv:'',abstract:'',sources:[] as object[],pdfUrl:'',notice:''};
 if(['arxiv.org','www.arxiv.org'].includes(u.hostname)){
  const id=u.pathname.match(/\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?)/)?.[1];if(!id)throw new HttpError(400,'未识别 arXiv 编号');
  const url=`https://arxiv.org/abs/${id}`;const r=await limitedFetch(url,3000000);const html=new TextDecoder().decode(r.data);const abstract=decode(html.match(/<blockquote[^>]*class="abstract[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1]||'').replace(/^Abstract:\s*/,'');
  return {...blank,title:meta(html,'citation_title')[0]||id,authors:meta(html,'citation_author'),year:Number(meta(html,'citation_date')[0]?.slice(0,4))||null,url,arxiv:id.replace(/v\d+$/,''),abstract,pdfUrl:`https://arxiv.org/pdf/${id}`,sources:[{url,kind:abstract?'abstract':'metadata',locator:'Abstract / bibliographic metadata',accessed:today}]};
 }
 if(u.hostname==='doi.org'||u.hostname==='dx.doi.org'){
  const doi=decodeURIComponent(u.pathname.slice(1));const r=await limitedFetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`,2000000);const m=JSON.parse(new TextDecoder().decode(r.data)).message;
  return {...blank,title:m.title?.[0]||doi,authors:(m.author||[]).map((a:{given?:string;family?:string})=>[a.given,a.family].filter(Boolean).join(' ')),year:m.published?.['date-parts']?.[0]?.[0]||null,venue:m['container-title']?.[0]||'',doi,abstract:decode(m.abstract||''),sources:[{url:u.href,kind:m.abstract?'abstract':'metadata',locator:'Crossref metadata',accessed:today}],notice:'已取得引用信息；全文如受限，请上传本地 PDF。'};
 }
 if(u.pathname.endsWith('.pdf')||u.hostname==='openreview.net'&&u.pathname==='/pdf')return {...blank,title:u.pathname.split('/').pop()?.replace(/\.pdf$/,'')||'未命名论文',pdfUrl:u.href,notice:'可以下载并解析这份 PDF。'};
 return {...blank,notice:'已保留论文链接。请补充标题，或上传 PDF 以便解析全文。'};
}
export async function attachPDF(user:string,id:string,pdf:ArrayBuffer,fileName:string){const p=await getPaper(user,id);if(p.hasPdf)throw new HttpError(409,'这篇论文已有原文，请使用现有 PDF');if(pdf.byteLength>MAX_PDF)throw new HttpError(413,'PDF 超过 25 MB');if(new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-')throw new HttpError(400,'文件不是有效的 PDF');await bindings().bucket.put(`${user}/${id}/paper.pdf`,pdf,{httpMetadata:{contentType:'application/pdf'}});p.hasPdf=true;p.fileName=fileName.slice(0,300);return persist(user,p)}
export async function downloadPaper(user:string,id:string,url:string){const p=await getPaper(user,id);if(p.hasPdf)return p;const r=await limitedFetch(url);if(new TextDecoder().decode(r.data.slice(0,5))!=='%PDF-')throw new HttpError(400,'来源没有返回 PDF，请使用本地上传');await bindings().bucket.put(`${user}/${id}/paper.pdf`,r.data,{httpMetadata:{contentType:'application/pdf'}});p.hasPdf=true;p.fileName=p.title+'.pdf';await persist(user,p);return p}
export async function searchPapers(query:string){if(!query.trim()||query.length>300)throw new HttpError(400,'请输入 1–300 个字符的关键词');const url='https://export.arxiv.org/api/query?'+new URLSearchParams({search_query:'all:'+query,start:'0',max_results:'8',sortBy:'relevance'});const {data}=await limitedFetch(url,2000000);const xml=new TextDecoder().decode(data);return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>{const tag=(n:string)=>decode(m[1].match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1]||'');return {title:tag('title'),url:tag('id').replace(/^http:/,'https:'),abstract:tag('summary'),year:Number(tag('published').slice(0,4)),authors:[...m[1].matchAll(/<name>([\s\S]*?)<\/name>/g)].map(x=>decode(x[1]))}})}
export async function listComparisons(user:string){const rows=await bindings().db.prepare('SELECT record FROM comparisons WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user).all<{record:string}>();return rows.results.map(r=>JSON.parse(r.record) as Comparison)}
export async function saveComparison(user:string,raw:unknown){const d=z.object({title:z.string().min(1).max(500),paperIds:z.array(z.string().uuid()).min(2).max(8),markdown:z.string().min(20).max(150000)}).parse(raw);for(const id of d.paperIds)await getPaper(user,id);const c={...d,id:crypto.randomUUID(),createdAt:new Date().toISOString()};await bindings().db.prepare('INSERT INTO comparisons (id,user_id,record,created_at) VALUES (?,?,?,?)').bind(c.id,user,JSON.stringify(c),c.createdAt).run();return c}
export async function deleteComparison(user:string,id:string){await bindings().db.prepare('DELETE FROM comparisons WHERE id = ? AND user_id = ?').bind(id,user).run();return {deleted:true}}
