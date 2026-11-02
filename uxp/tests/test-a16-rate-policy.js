/* MPL-2.0. Scheduler regression, fake providers and documents; no real external requests. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root=path.resolve(__dirname,'../chrome/content');
const prefs={
 'extensions.twpuxp.from':'en', 'extensions.twpuxp.to':'cs',
 'extensions.twpuxp.translationService':'deepl',
 'extensions.twpuxp.maxNodes':0,'extensions.twpuxp.batchSize':8,
 'extensions.twpuxp.concurrentRequests':3, 'extensions.twpuxp.timeoutMs':12000,
 'extensions.twpuxp.requestDelayMs':0,'extensions.twpuxp.useTwpParagraphEngine':true,
 'extensions.twpuxp.translateDynamicContent':false,
 'extensions.twpuxp.translatePageAttributes':false,
 'extensions.twpuxp.translateIframes':false,
 'extensions.twpuxp.toolbarInserted':true
};
const ps={getCharPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
 getIntPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
 getBoolPref(k){if(!(k in prefs))throw Error(k);return prefs[k]},
 setCharPref(k,v){prefs[k]=v},setBoolPref(k,v){prefs[k]=v}};
let activeDoc, inFlight=0, maxFlight=0, calls=[], fail429=false;
function makeDoc() {
 const body={appendChild(el){el.parentNode=this;this.el=el},removeChild(el){el.parentNode=null},
  querySelectorAll(){return []}};
 const nodes=Array.from({length:4},(_,i)=>({nodeValue:'English '.repeat(70)+i,parentNode:body}));
 return {body,nodes,location:{protocol:'https:',hostname:'example.com',port:''},
  querySelectorAll(){return []},
  getElementById(id){return body.el && body.el.id===id ? body.el : null},
  createElement(){return {id:'',style:{},setAttribute(){},parentNode:null,textContent:''}}};
}
function translate(batch,source,target,doc,key,timeout,done){
 inFlight++;maxFlight=Math.max(maxFlight,inFlight);
 calls.push({service:prefs['extensions.twpuxp.translationService'],at:Date.now()});
 setTimeout(()=>{
  inFlight--;
  if(fail429){let err=Error('DeepL HTTP 429');err.httpStatus=429;err.rateLimited=true;done(err);}
  else done(null,batch.map(p=>p.originals.map(()=> 'Český překlad')));
 },20);
}
const fakeProvider={translatePieces:translate,translateMany(texts,source,target,doc,key,timeout,done){
 translate(texts.map(t=>({originals:[t]})),source,target,doc,key,timeout,(err,results)=>done(err,results&&results.map(r=>r[0])));
}};
const events={};
const ctx=vm.createContext({TWPUXPCache:{translatePieces(p,s,b,src,tgt,d,k,timeout,cb){return p.translatePieces(b,src,tgt,d,k,timeout,cb)},translateMany(p,s,b,src,tgt,d,k,timeout,cb){return p.translateMany(b,src,tgt,d,k,timeout,cb)},close(){}},Date,Set,WeakMap,Map,setTimeout,clearTimeout,console,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return ps}}},interfaces:{nsIPrefBranch:{}}},
 gBrowser:{selectedBrowser:{get contentDocument(){return activeDoc}},addEventListener(){},removeEventListener(){},
   tabContainer:{addEventListener(){},removeEventListener(){}}},
 document:{getElementById(id){if(id==='mainPopupSet')return {appendChild(){}};return null},
  createElement(){return {setAttribute(){},appendChild(){},addEventListener(){}}},getElementsByTagName(){return []}},
 window:{addEventListener(n,fn){events[n]=fn},removeEventListener(){},alert(){}},
 TWPUXPProviders:{has(n){return ['deepl','google','bing'].includes(n)},get(){return fakeProvider}},
 TWPUXPPageTranslator:{collect(doc){return doc.nodes.map(n=>({nodes:[n],originals:[n.nodeValue]}))},
  prioritizeVisible(a){return a},apply(p,res,originals){let n=p.nodes[0];originals.push({node:n,original:n.nodeValue,translated:res[0]});n.nodeValue=res[0];return 1}}
});
for (const name of ['pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const pause=t=>new Promise(r=>setTimeout(r,t));
async function waitFor(predicate, timeoutMs=6500) {
 const started=Date.now();
 while(!predicate() && Date.now()-started<timeoutMs) await pause(40);
 assert.ok(predicate(), 'Timed out waiting for translation completion');
}
(async()=>{
 activeDoc=makeDoc();
 ctx.TWPUXP.translateCurrentPage();
 await waitFor(()=>activeDoc.nodes.every(n=>n.nodeValue==='Český překlad'));
 assert.equal(calls.length,4,'DeepL should finish all four pieces');
 assert.equal(maxFlight,1,'DeepL permits only one in-flight request');
 for(let i=1;i<calls.length;i++)
  assert.ok(calls[i].at-calls[i-1].at>=1150,'DeepL requests must be paced');
 assert.ok(activeDoc.nodes.every(n=>n.nodeValue==='Český překlad'));
 // Google must preserve its original fast parallel requests.
 prefs['extensions.twpuxp.translationService']='google';
 activeDoc=makeDoc(); inFlight=0; maxFlight=0; calls=[];
 ctx.TWPUXP.translateCurrentPage();
 await pause(200);
 assert.equal(calls.length,4);
 assert.ok(maxFlight>=2,'Google should keep the previous parallel planner');
 assert.ok(activeDoc.nodes.every(n=>n.nodeValue==='Český překlad'));
 // Once DeepL rate-limits the request, abort immediately. Do not send all other batches.
 prefs['extensions.twpuxp.translationService']='deepl';
 activeDoc=makeDoc(); inFlight=0;maxFlight=0;calls=[];fail429=true;
 ctx.TWPUXP.translateCurrentPage();
 await pause(200);
 assert.equal(calls.length,1,'DeepL HTTP 429 must stop future dispatches');
 assert.ok(activeDoc.nodes.every(n=>n.nodeValue.startsWith('English')));
 assert.match(activeDoc.body.el.textContent,/DeepL has limited translation requests/);
 console.log('PASS: DeepL serial request spacing, Google unaffected, HTTP 429 immediate stop.');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
