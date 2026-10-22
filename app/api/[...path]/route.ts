import * as service from '@/lib/paper-server';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
async function handler(req:Request,{params}:Context){try{
 const user=service.actor(req);if(req.method!=='GET')service.checkOrigin(req);const {path}=await params;const [resource,id,action]=path;const url=new URL(req.url);let result:unknown;
 if(resource==='session')result={authenticated:true,name:req.headers.get('oai-authenticated-user-full-name')||req.headers.get('oai-authenticated-user-email')||'研究者'};
 else if(resource==='resolve'&&req.method==='POST')result=await service.resolveLink((await service.body(req)).url);
 else if(resource==='discover'&&req.method==='GET')result=await service.searchPapers(url.searchParams.get('q')||'');
 else if(resource==='comparisons'){result=req.method==='DELETE'&&id?await service.deleteComparison(user,id):req.method==='POST'?await service.saveComparison(user,await service.body(req)):await service.listComparisons(user)}
 else if(resource==='papers'){
  if(!id&&req.method==='GET')result=await service.listPapers(user);
  else if(!id&&req.method==='POST'){
   if(req.headers.get('content-type')?.includes('multipart/form-data')){if(Number(req.headers.get('content-length'))>27000000)throw new service.HttpError(413,'文件超过 25 MB');const f=await req.formData();const file=f.get('file');if(!(file instanceof File))throw new service.HttpError(400,'请选择 PDF');result=await service.importPaper(user,JSON.parse(String(f.get('metadata')||'{}')),await file.arrayBuffer())}
   else result=await service.importPaper(user,await service.body(req));
  } else if(action==='file'&&req.method==='GET')return await service.fileResponse(user,id);
  else if(action==='upload'&&req.method==='POST'){if(Number(req.headers.get('content-length'))>27000000)throw new service.HttpError(413,'文件超过 25 MB');const f=await req.formData(),file=f.get('file');if(!(file instanceof File))throw new service.HttpError(400,'请选择 PDF');result={paper:await service.attachPDF(user,id,await file.arrayBuffer(),file.name),duplicate:false}}
  else if(action==='text'){result=req.method==='POST'?await service.savePages(user,id,await service.body(req,8500000)):await service.getPages(user,id)}
  else if(action==='download'&&req.method==='POST')result=await service.downloadPaper(user,id,(await service.body(req)).url);
  else if(action==='analysis'&&req.method==='POST'){const d=await service.body(req);result=await service.saveAnalysis(user,id,d.analysis,d.tags)}
  else if(req.method==='PATCH')result=await service.updatePaper(user,id,await service.body(req));
  else if(req.method==='DELETE')result=await service.deletePaper(user,id);
  else if(req.method==='GET')result=await service.getPaper(user,id);
  else throw new service.HttpError(405,'不支持此操作');
 }else throw new service.HttpError(404,'接口不存在');
 return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return Response.json({error:e instanceof Error?e.message:'请求失败'},{status:e instanceof service.HttpError?e.status:400,headers:{'Cache-Control':'no-store'}})}}
export const GET=handler,POST=handler,PATCH=handler,DELETE=handler;
