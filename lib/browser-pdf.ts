import type {PaperPage} from './paper-types';
export async function parsePDF(data:ArrayBuffer,onProgress:(s:string)=>void){
 const lib=await import('pdfjs-dist');lib.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';
 const task=lib.getDocument({data:new Uint8Array(data),cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/'});
 const pdf=await task.promise;if(pdf.numPages>400){await pdf.destroy();throw new Error('暂支持 400 页以内的 PDF')}
 const pages:PaperPage[]=[];
 try{for(let page=1;page<=pdf.numPages;page++){onProgress(`正在解析第 ${page} / ${pdf.numPages} 页`);const p=await pdf.getPage(page),content=await p.getTextContent();pages.push({page,text:content.items.map(i=>'str' in i?i.str+(i.hasEOL?'\n':' '):'').join('').trim()});p.cleanup()}}finally{await pdf.destroy()}
 return pages;
}
