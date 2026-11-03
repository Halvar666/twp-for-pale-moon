/* MPL-2.0. DeepL selected-text pacing on the real b2a3 selection controller. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../chrome/content/selectionController.js'),'utf8');
const original='x'.repeat(7060); // 10 translation fragments at <=780 characters.
const doc={};
const prefs={from:'auto',to:'cs',translationService:'deepl'};
const calls=[];
const dialog=[];
const ctx=vm.createContext({
 console,Date,Array,Math,Error,setTimeout,clearTimeout,
 window:{openDialog(...args){dialog.push(args)},alert(m){throw Error(m)}},
 TWPUXPLanguage:{detect(){return 'en'}},
 TWPUXPProviders:{has(service){return ['deepl','google'].includes(service)},get(service){return {name:service}}},
 TWPUXPCache:{translateMany(provider,service,texts,src,tgt,origin,key,timeout,callback){
  calls.push({provider:provider.name,when:Date.now(),n:texts.length});
  callback(null,texts.map((x,i)=>'OK'+i));
 }}
});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../chrome/content/textLayout.js'),'utf8'),ctx);
vm.runInContext(code,ctx);
const controller=ctx.TWPUXPSelectionController.create({
 getDoc(){return doc},getString(k,f){return k in prefs?prefs[k]:f},
 getInt(k,f){return k==='batchSize'?8:f},setString(k,v){prefs[k]=v}
});
function run(service){
 prefs.translationService=service;calls.length=0;dialog.length=0;
 controller.translateSelectedText({text:original,doc});
 assert.equal(dialog.length,1);
 return new Promise((resolve,reject)=>{
  dialog[0][3].request((e,v)=>e?reject(e):resolve(v));
 });
}
(async()=>{
 let result=await run('deepl');
 assert.ok(result.startsWith('OK0'));
 assert.equal(calls.length,2,'DeepL must batch >8 long selection pieces');
 assert.equal(calls.every(x=>x.provider==='deepl'),true);
 assert.ok(calls[1].when-calls[0].when>=680,'DeepL requests need >=~700 ms dispatch interval');
 result=await run('google');
 assert.equal(calls.length,2);
 assert.ok(calls[1].when-calls[0].when<150,'Google selection requests should not inherit DeepL delay');
 console.log('PASS b2a3: DeepL selection paced, Google selection unaffected');
})().catch(e=>{console.error(e);process.exit(1)});
