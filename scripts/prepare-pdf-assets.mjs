import {mkdir,copyFile,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve('node_modules/pdfjs-dist'),target=resolve('public/pdf');
await mkdir(target,{recursive:true});
await copyFile(source+'/build/pdf.worker.min.mjs',target+'/pdf.worker.min.mjs');
for(const dir of ['cmaps','standard_fonts','wasm'])await cp(source+'/'+dir,target+'/'+dir,{recursive:true});
await copyFile(source+'/LICENSE',target+'/LICENSE');
console.log('PDF.js worker, CMaps, fonts and WASM prepared.');
