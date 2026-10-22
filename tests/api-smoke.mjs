import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Smoke test is local only.');
const signIn=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=signIn.headers.get('set-cookie')?.split(';')[0]||'';
async function call(path,method='GET',data,auth=true){const r=await fetch(base+path,{method,headers:{...(auth?{Cookie:cookie}:{}),...(data instanceof FormData?{}:data?{'Content-Type':'application/json'}:{})},body:data instanceof FormData?data:data?JSON.stringify(data):undefined});return {status:r.status,value:await r.json()}}
async function rpc(name,args){const r=await call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});return r.value.result}
assert.equal((await call('/api/papers','GET',undefined,false)).status,401);
const spoof=await fetch(base+'/api/papers',{headers:{'oai-authenticated-user-id':'forged'}});assert.equal(spoof.status,401);
assert.equal((await fetch(base+'/api/papers',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
const discovery=await call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'server/discover'});assert.ok(discovery.value.result.supportedVersions.includes('2026-07-28'));
const listed=await call('/mcp','POST',{jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal(listed.value.result.tools.length,8);
const rpcNoAuth=await call('/mcp','POST',{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'paper_list',arguments:{}}},false);assert.equal(rpcNoAuth.value.result.isError,true);

// A small real PDF with searchable text, created only as a test fixture.
const content='BT /F1 18 Tf 48 750 Td (Robotics Paper Studio - test fixture '+Date.now()+') Tj 0 -32 Td /F1 12 Tf (Observation to policy to action. Synthetic PDF for parser validation.) Tj ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
mkdirSync('.sites-runtime/fixtures',{recursive:true});writeFileSync('.sites-runtime/fixtures/parser-test.pdf',pdf);
const ids=[];let comparison;
try{
 const form=()=>{const f=new FormData();f.append('metadata',JSON.stringify({title:'[SMOKE] parser fixture',fileName:'parser-test.pdf'}));f.append('file',new Blob([pdf],{type:'application/pdf'}),'parser-test.pdf');return f};
 const created=await call('/api/papers','POST',form());assert.equal(created.status,200,JSON.stringify(created.value));const p=created.value.paper;ids.push(p.id);assert.equal(p.evidenceLevel,'metadata');assert.equal(p.hasPdf,true);
 const duplicate=await call('/api/papers','POST',form());assert.equal(duplicate.value.duplicate,true);assert.equal(duplicate.value.paper.id,p.id);
 assert.equal((await call('/api/papers/'+p.id+'/text','POST',[{page:2,text:'Bad order'}])).status,400);
 await call('/api/papers/'+p.id+'/text','POST',[{page:1,text:'Observation to policy to action. '.repeat(500)}]);
 const parsed=await call('/api/papers/'+p.id);assert.equal(parsed.value.status,'parsed');assert.equal(parsed.value.evidenceLevel,'metadata');
 await call('/api/papers/'+p.id,'PATCH',{userNotes:'Keep my note',status:'queued'});
 const read=await rpc('paper_read',{id:p.id,page_count:1});assert.equal(read.isError,false);assert.equal(read.structuredContent.data.pages[0].truncated,true);
 const continuation=await rpc('paper_read',{id:p.id,page_count:1,char_offset:12000});assert.equal(continuation.structuredContent.data.pages[0].truncated,false);
 const analysis={summary:'Synthetic fixture only',problem:'Validate writeback',contributions:[],pipeline:[{label:'Observation',detail:'Test',source:'p.1'}],training:'Unreported',inference:'Test',experiments:[],limitations:['Not a real paper'],markdown:'# Synthetic fixture\n\nThis validates structured writeback.',evidenceLevel:'fulltext',sources:[{url:`attachments/${p.id}.pdf`,kind:'fulltext',locator:'p.1',accessed:'2026-10-22'}]};
 const saved=await rpc('paper_save_analysis',{id:p.id,analysis,tags:['mpc']});assert.equal(saved.isError,false,JSON.stringify(saved));assert.equal(saved.structuredContent.data.userNotes,'Keep my note');assert.equal(saved.structuredContent.data.status,'analyzed');
 const downgrade=await rpc('paper_save_analysis',{id:p.id,analysis:{...analysis,evidenceLevel:'metadata'}});assert.equal(downgrade.isError,true);
 const other=await call('/api/papers','POST',{title:'[SMOKE] linked fixture',url:'https://example.com/robotics-paper',tags:['mpc']});ids.push(other.value.paper.id);
 const related=await rpc('paper_similar',{id:p.id});assert.ok(related.structuredContent.data.some(x=>x.id===other.value.paper.id));
 const compare=await rpc('comparison_save',{title:'[SMOKE] comparison',paperIds:ids,markdown:'# Synthetic comparison\n\nNot research evidence. Test only.'});assert.equal(compare.isError,false);comparison=compare.structuredContent.data.id;
 const addPDF=new FormData();addPDF.append('file',new Blob([pdf],{type:'application/pdf'}),'attached.pdf');const attached=await call('/api/papers/'+other.value.paper.id+'/upload','POST',addPDF);assert.equal(attached.value.paper.id,other.value.paper.id);assert.equal(attached.value.paper.hasPdf,true);
 console.log('API PASS: authentication, origin, PDF upload and attachment, deduplication, page validation, evidence boundaries, MCP pagination, analysis writeback, note preservation, similarity, comparisons.');
}finally{for(const id of ids)await call('/api/papers/'+id,'DELETE');if(comparison)await call('/api/comparisons/'+comparison,'DELETE')}

const resolved=await call("/api/resolve","POST",{url:"https://arxiv.org/abs/2303.04137"});
if(resolved.status===200){assert.ok(resolved.value.title.includes("Diffusion Policy"));assert.ok(resolved.value.authors.length>0);console.log("SOURCE PASS: live arXiv metadata and abstract resolution.")}else console.log("SOURCE UNAVAILABLE:",resolved.value.error);
const search=await call("/api/discover?q=bimanual%20manipulation");if(search.status===200){assert.ok(search.value.length>0);console.log("SEARCH PASS: live arXiv search.")}else console.log("SEARCH UNAVAILABLE:",search.value.error);
