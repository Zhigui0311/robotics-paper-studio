import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {analysisSchema,checkedLink,downloadableURL,canonicalIdentity,similarity} from '../lib/paper-validation.ts';
import {portableFiles} from '../lib/library-export.ts';
import type {Paper} from '../lib/paper-types.ts';

const analysis={summary:'Test fixture',problem:'Test',contributions:[],pipeline:[],training:'Unreported',inference:'Unreported',experiments:[],limitations:[],markdown:'# Test report\n\nThis is a synthetic fixture.',evidenceLevel:'abstract',sources:[{url:'https://arxiv.org/abs/2303.04137',kind:'abstract',locator:'Abstract',accessed:'2026-10-22'}]};
test('evidence upgrades require the corresponding sources',()=>{
 assert.equal(analysisSchema.safeParse(analysis).success,true);
 assert.equal(analysisSchema.safeParse({...analysis,evidenceLevel:'fulltext'}).success,false);
 const full={...analysis,evidenceLevel:'fulltext',sources:[{...analysis.sources[0],kind:'fulltext'}]};
 assert.equal(analysisSchema.safeParse(full).success,true);
 assert.equal(analysisSchema.safeParse({...full,evidenceLevel:'fulltext+code'}).success,false);
 assert.equal(analysisSchema.safeParse({...analysis,sources:[{...analysis.sources[0],url:'javascript:alert(1)'}]}).success,false);
});
test('downloads reject credentials, local addresses, ports and unapproved hosts',()=>{
 for(const url of ['http://arxiv.org/pdf/123','https://arxiv.org.evil.test/x','https://127.0.0.1/a','https://user:password@arxiv.org/x','https://arxiv.org:8080/a','file:///etc/passwd'])assert.throws(()=>downloadableURL(url));
 assert.equal(downloadableURL('https://arxiv.org/pdf/2303.04137').hostname,'arxiv.org');
 assert.equal(checkedLink('10.1000/test').href,'https://doi.org/10.1000/test');
});
test('identity recognizes arxiv versions, DOI case and file hashes',()=>{
 assert.equal(canonicalIdentity({title:'A',arxiv:'2303.04137v5'}),canonicalIdentity({title:'B',arxiv:'2303.04137'}));
 assert.equal(canonicalIdentity({title:'A',doi:'https://doi.org/10.1000/Test'}),'doi:10.1000/test');
 assert.equal(canonicalIdentity({title:'Renamed'},'abc'),'pdf:abc');
});
test('similarity exposes only keyword and tag evidence',()=>{
 const r=similarity({title:'Diffusion policy for robots',tags:['dual-arm']},{title:'Diffusion for manipulation',tags:['dual-arm']});
 assert.deepEqual(r.shared,['dual-arm']);assert.ok(r.terms.includes('diffusion'));assert.equal(r.score,5);
});
test('export separates studio snapshot and portable skill records',()=>{
 const paper={id:'test-paper',title:'Synthetic test paper',authors:[],year:null,venue:'',url:'',doi:'',arxiv:'',abstract:'',tags:['mpc','quadruped','custom-topic'],status:'unread',evidenceLevel:'metadata',createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z',pageCount:0,textChars:0,hasPdf:false,fileName:'',parsingWarning:'',userNotes:'Personal note',analysis:null,readingScope:'',sources:[]} as Paper;
 const files=portableFiles([paper],[]),record=JSON.parse(files['records/test-paper.json']);
 assert.equal(record.schema_version,1);assert.deepEqual(record.tags.method,['mpc']);assert.deepEqual(record.tags.custom,['custom-topic']);assert.equal(record.evidence_level,'metadata');
 assert.ok(files['notes/test-paper.md'].includes('Personal note'));assert.equal(JSON.parse(files['studio.json']).papers[0].id,paper.id);
 const kb=process.env.KB_SCRIPT;
 if(kb){const dir=mkdtempSync(join(tmpdir(),'paper-export-test-'));try{for(const [name,content] of Object.entries(files)){if(name.endsWith('/'))mkdirSync(join(dir,name),{recursive:true});else {mkdirSync(dirname(join(dir,name)),{recursive:true});writeFileSync(join(dir,name),content)}}const result=spawnSync('python3',[kb,'--root',dir,'audit'],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr)}finally{rmSync(dir,{recursive:true,force:true})}}
});
