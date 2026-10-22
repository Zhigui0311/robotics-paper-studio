import * as s from '@/lib/paper-server';
import { similarity } from '@/lib/paper-validation';
import { z } from 'zod';
export const dynamic='force-dynamic';
const str={type:'string'},strings={type:'array',items:str};
const obj=(properties:Record<string,unknown>,required:string[])=>({type:'object',properties,required,additionalProperties:false});
const source=obj({url:str,kind:{type:'string',enum:['metadata','abstract','fulltext','code']},locator:str,accessed:str},['url','kind','locator','accessed']);
const analysis=obj({summary:str,problem:str,contributions:strings,pipeline:{type:'array',items:obj({label:str,detail:str,source:str},['label','detail','source'])},training:str,inference:str,experiments:{type:'array',items:obj({claim:str,result:str,conditions:str,source:str},['claim','result','conditions','source'])},limitations:strings,markdown:str,evidenceLevel:{type:'string',enum:['metadata','abstract','fulltext','fulltext+code']},sources:{type:'array',items:source}},['summary','problem','contributions','pipeline','training','inference','experiments','limitations','markdown','evidenceLevel','sources']);
const tools=[
 {name:'paper_list',description:'读取当前用户的论文库，包括待精读任务。返回标识、摘要、分类和已有证据等级。',inputSchema:obj({status:{type:'string',enum:['unread','parsed','queued','analyzed']},query:str},[])},
 {name:'paper_read',description:'读取指定论文、逐页原文、用户笔记和已有分析。仅得到摘要或截断页时不得声称已读全文。继续调整 page_start / char_offset 直到覆盖所需内容。PDF 图表需结合原始论文页面核实。',inputSchema:obj({id:str,page_start:{type:'integer',minimum:1},page_count:{type:'integer',minimum:1,maximum:6},char_offset:{type:'integer',minimum:0}},['id'])},
 {name:'paper_similar',description:'从当前用户的库中召回分类和关键词相似论文，分数不是技术优劣或语义等价证明。',inputSchema:obj({id:str},['id'])},
 {name:'paper_search_web',description:'查询公开 arXiv API，返回相关论文元数据和摘要，不将其冒充全文。',inputSchema:obj({query:str},['query'])},
 {name:'paper_save_analysis',description:'将用户请求的论文分析写回网站，保留用户笔记和历史分析。按 robotics-paper-workbench 工作流填写。训练与部署分开，实验标明条件，关键判断有原文定位；缺失项目明确写未报告。摘要级结果不会标为已精读。',inputSchema:obj({id:str,analysis,tags:strings},['id','analysis'])},
 {name:'paper_update_tags',description:'更新用户指定论文的多维分类标签，不改变用户笔记或分析。',inputSchema:obj({id:str,tags:strings},['id','tags'])},
 {name:'comparison_save',description:'保存用户请求的论文比较报告。至少两篇本库论文，Markdown 中必须说明来源、可比性及局限。',inputSchema:obj({title:str,paperIds:strings,markdown:str},['title','paperIds','markdown'])},
 {name:'comparison_list',description:'读取当前用户已保存的比较报告。',inputSchema:obj({},[])},
];
export async function POST(req:Request){let id:unknown=null;try{
 s.checkOrigin(req);const rpc=await s.body(req,350000);id=rpc.id??null;
 const result=(value:unknown)=>Response.json({jsonrpc:'2.0',id,result:value},{headers:{'Cache-Control':'no-store'}});
 if(rpc.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(rpc.method==='initialize')return result({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'robotics-paper-studio',version:'1.0.0'}});
 if(rpc.method==='notifications/initialized')return new Response(null,{status:204});
 if(rpc.method==='tools/list')return result({tools});
 if(rpc.method!=='tools/call')return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
 const user=s.actor(req),name=rpc.params?.name,a=rpc.params?.arguments||{};let value:unknown;
 const paperId=()=>z.string().uuid().parse(a.id);
 if(name==='paper_list'){let papers=await s.listPapers(user);if(a.status)papers=papers.filter(p=>p.status===a.status);if(a.query)papers=papers.filter(p=>(p.title+' '+p.abstract+' '+p.tags.join(' ')).toLowerCase().includes(String(a.query).toLowerCase()));value=papers.map(({analysis,userNotes,...p})=>({...p,hasAnalysis:!!analysis,hasNotes:!!userNotes}));}
 else if(name==='paper_read'){const id=paperId(),p=await s.getPaper(user,id),pages=await s.getPages(user,id);const start=z.number().int().min(1).parse(a.page_start??1),count=z.number().int().min(1).max(6).parse(a.page_count??4),offset=z.number().int().min(0).parse(a.char_offset??0);value={paper:p,totalPages:pages.length,pages:pages.filter(p=>p.page>=start).slice(0,count).map(p=>({page:p.page,text:p.text.slice(offset,offset+12000),totalChars:p.text.length,charOffset:offset,truncated:p.text.length>offset+12000})),nextPage:start+count<=pages.length?start+count:null,readingNotice:pages.length?'这是机器提取文本；公式、双栏顺序、图表需对照原文。':'尚未提取全文，当前可能只有元数据或摘要；可打开论文原文核实。'}}
 else if(name==='paper_similar'){const p=await s.getPaper(user,paperId());value=(await s.listPapers(user)).filter(x=>x.id!==p.id).map(x=>({id:x.id,title:x.title,evidenceLevel:x.evidenceLevel,...similarity(p,x)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8)}
 else if(name==='paper_search_web')value=await s.searchPapers(z.string().max(300).parse(a.query));
 else if(name==='paper_save_analysis')value=await s.saveAnalysis(user,paperId(),a.analysis,a.tags);
 else if(name==='paper_update_tags')value=await s.updatePaper(user,paperId(),{tags:a.tags});
 else if(name==='comparison_save')value=await s.saveComparison(user,a);
 else if(name==='comparison_list')value=await s.listComparisons(user);
 else throw new Error('未知工具');
 return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:{data:value},isError:false});
}catch(e){return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:e instanceof Error?e.message:'调用失败'}],isError:true}},{headers:{'Cache-Control':'no-store'}})}}
