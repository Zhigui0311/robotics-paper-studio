'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ExternalLink,Loader2} from 'lucide-react';
import type {PDFDocumentProxy} from 'pdfjs-dist';

export function PaperPDF({id}:{id:string}){
 const [pdf,setPDF]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[error,setError]=useState(''),[rendering,setRendering]=useState(true);
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let cancelled=false,document:PDFDocumentProxy|undefined;setPDF(null);setPage(1);setError('');setRendering(true);
  (async()=>{const lib=await import('pdfjs-dist');lib.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';const response=await fetch(`/api/papers/${id}/file`);if(!response.ok)throw new Error('原文读取失败');document=await lib.getDocument({data:new Uint8Array(await response.arrayBuffer()),cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/'}).promise;if(cancelled)await document.destroy();else setPDF(document)})().catch(e=>{if(!cancelled){setError(e.message);setRendering(false)}});
  return()=>{cancelled=true;document?.destroy()};
 },[id]);
 useEffect(()=>{if(!pdf||!canvas.current)return;let cancelled=false,task:{cancel:()=>void}|undefined;setRendering(true);
  (async()=>{const p=await pdf.getPage(page);if(cancelled||!canvas.current)return;const viewport=p.getViewport({scale:1.5}),node=canvas.current;node.width=viewport.width;node.height=viewport.height;const render=p.render({canvas:node,viewport});task=render;await render.promise;if(!cancelled)setRendering(false)})().catch(e=>{if(!cancelled&&e.name!=='RenderingCancelledException'){setError(e.message);setRendering(false)}});
  return()=>{cancelled=true;task?.cancel()};
 },[pdf,page]);
 return <div className="pdf-viewer"><div className="page-controls"><button aria-label="上一页原文" disabled={!pdf||page===1} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={15}/></button><span>第 {page} / {pdf?.numPages||'…'} 页</span><button aria-label="下一页原文" disabled={!pdf||page===pdf.numPages} onClick={()=>setPage(p=>p+1)}><ArrowRight size={15}/></button><a href={`/api/papers/${id}/file`} target="_blank" rel="noreferrer" aria-label="在新窗口打开 PDF"><ExternalLink size={15}/></a></div>{error?<div className="notice error">{error}，可在新窗口打开原文件。</div>:<div className="pdf-canvas-area">{rendering&&<div className="pdf-render-status"><Loader2 className="spin" size={18}/>正在显示原文</div>}<canvas ref={canvas} aria-label={`PDF 原文第 ${page} 页`}/></div>}</div>;
}
