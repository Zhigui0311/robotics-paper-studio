import type {Paper,Comparison} from './paper-types';

const dimensions:Record<string,string[]>={
 task:['manipulation','bimanual-manipulation','deformable-manipulation','locomotion','navigation'],
 method:['imitation-learning','diffusion-policy','action-chunking','reinforcement-learning','vla','mpc','whole-body-control'],
 embodiment:['single-arm','dual-arm','humanoid','quadruped','dexterous-hand'],
 validation:['real-robot','simulation','sim-to-real','theoretical'],
};
const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
const md=(s:string)=>s.replace(/[\n|]/g,' ').replace(/\[/g,'\\[').replace(/\]/g,'\\]');
const bib=(s:unknown)=>String(s).replace(/[\\{}%&#_$]/g,c=>'\\'+c);

/** Portable skill schema v1, with a separate exact snapshot for website restore. */
export function portableFiles(papers:Paper[],comparisons:Comparison[]):Record<string,string>{
 const now=new Date().toISOString(),files:Record<string,string>={
  'studio.json':json({version:1,papers,comparisons}),
  'library.json':json({schema_version:1,language:'zh-CN',created_at:now,storage:'relative-paths'}),
  'README.txt':'此文件夹兼容 robotics-paper-workbench。使用 kb.py --root <目录> audit 检查，reindex 重建索引。studio.json 用于在网站中恢复；records/notes/attachments 可独立长期保存。\n',
 };
 for(const dir of ['records','notes','attachments','comparisons','searches','history','text'])files[dir+'/']='';
 const index=['# 机器人论文知识库','','| 论文 | 年份 | 状态 | 证据 |','|---|---|---|---|'],citations:string[]=[];
 for(const p of papers){
  const attachment=`attachments/${p.id}.pdf`,metadata=`attachments/${p.id}-metadata.json`;
  files[metadata]=json({title:p.title,authors:p.authors,url:p.url,abstract:p.abstract,imported_at:p.createdAt});
  const tags:Record<string,string[]>={domain:['robotics'],task:[],method:[],embodiment:[],observation:[],action:[],validation:[],custom:[]};
  for(const t of p.tags){const dim=Object.keys(dimensions).find(d=>dimensions[d].includes(t))||'custom';tags[dim].push(t)}
  const sources=(p.analysis?.sources.length?p.analysis.sources:p.sources).map(s=>({...s,url:s.url.startsWith('attachments/')||s.url.includes(`/api/papers/${p.id}/file`)?(p.hasPdf?attachment:metadata):s.url}));
  if(!sources.length)sources.push({url:p.url||(p.hasPdf?attachment:metadata),kind:p.abstract?'abstract':'metadata',locator:p.abstract?'Imported abstract':'Imported metadata; bibliographic details may need verification',accessed:p.createdAt.slice(0,10)});
  const record={schema_version:1,id:p.id,title:p.title,authors:p.authors,year:p.year,venue:p.venue||null,
   identifiers:{doi:p.doi||null,arxiv:p.arxiv||null,openreview:null},urls:{paper:p.url||null,pdf:p.hasPdf?attachment:null},
   reading_status:p.status==='analyzed'?'analyzed':p.status==='queued'||p.status==='unread'?'queued':'skimmed',evidence_level:p.evidenceLevel,
   summary:p.analysis?.summary||p.abstract,tags,sources,results:[],relations:[],attachments:[metadata,...p.hasPdf?[attachment]:[]],note_path:`notes/${p.id}.md`,
   created_at:p.createdAt,updated_at:p.updatedAt,studio_analysis:p.analysis};
  files[`records/${p.id}.json`]=json(record);
  files[`notes/${p.id}.md`]=`# ${p.title}\n\n${p.analysis?.markdown||'尚未精读。\n\n'+p.abstract}\n\n## 用户笔记\n\n${p.userNotes}\n`;
  index.push(`| [${md(p.title)}](notes/${p.id}.md) | ${p.year||'未知'} | ${record.reading_status} | ${p.evidenceLevel} |`);
  const fields:Record<string,unknown>={title:p.title};if(p.authors.length)fields.author=p.authors.join(' and ');if(p.year)fields.year=p.year;if(p.url)fields.url=p.url;if(p.doi)fields.doi=p.doi;if(p.arxiv){fields.eprint=p.arxiv;fields.archivePrefix='arXiv'}
  citations.push(`@misc{${p.id},\n${Object.entries(fields).map(([k,v])=>`  ${k} = {${bib(v)}}`).join(',\n')}\n}`);
 }
 for(const c of comparisons)files[`comparisons/${c.id}.md`]=c.markdown;
 files['index.md']=index.join('\n')+'\n';files['bibliography.bib']=citations.join('\n\n')+'\n';return files;
}
