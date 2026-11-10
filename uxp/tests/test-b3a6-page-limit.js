/* MPL-2.0. Page stops on HTTP 429, shows the cooldown, and keeps partial restore safe. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.resolve(__dirname,'../chrome/content');
const prefValues={
 'extensions.twpuxp.from':'en','extensions.twpuxp.to':'cs',
 'extensions.twpuxp.translationService':'google','extensions.twpuxp.maxNodes':0,
 'extensions.twpuxp.batchSize':8,'extensions.twpuxp.concurrentRequests':1,
 'extensions.twpuxp.timeoutMs':12000,'extensions.twpuxp.requestDelayMs':0,
 'extensions.twpuxp.useTwpParagraphEngine':true,
 'extensions.twpuxp.translateDynamicContent':false,
 'extensions.twpuxp.translatePageAttributes':false,
 'extensions.twpuxp.translateIframes':false,
 'extensions.twpuxp.toolbarInserted':true
};
const pref={
 getCharPref(key){if(!(key in prefValues))throw Error(key);return prefValues[key]},
 getIntPref(key){if(!(key in prefValues))throw Error(key);return prefValues[key]},
 getBoolPref(key){if(!(key in prefValues))throw Error(key);return prefValues[key]},
 setCharPref(key,value){prefValues[key]=value},setBoolPref(key,value){prefValues[key]=value}
};
let doc, networkCalls=0, staleCallback=null;
function createDoc(){
 const body={appendChild(el){el.parentNode=this;this.status=el},removeChild(el){el.parentNode=null},querySelectorAll(){return []}};
 const nodes=Array.from({length:3},(_,i)=>({nodeValue:'English '+String(i)+' '.repeat(800),parentNode:body}));
 return {body,nodes,location:{protocol:'https:',hostname:'example.test',port:''},querySelectorAll(){return []},
  getElementById(id){return this.body.status&&this.body.status.id===id?this.body.status:null},
  createElement(){return {id:'',style:{},setAttribute(){},parentNode:null,textContent:''}}};
}
const provider={
 translatePieces(batch,src,tgt,origin,key,timeout,callback){
   networkCalls++;
   if(networkCalls===1){setTimeout(()=>callback(null,batch.map(p=>p.originals.map(()=> 'Přeloženo'))),5);return;}
   const error=Error('Google endpoint HTTP 429');
   error.httpStatus=429;error.rateLimited=true;error.retryable=false;error.retryAfterMs=91000;
   staleCallback=()=>callback(null,batch.map(p=>p.originals.map(()=> 'LATE WRITE')));
   setTimeout(()=>callback(error),5);
 },
 translateMany(values,src,tgt,origin,key,timeout,callback){
  this.translatePieces(values.map(v=>({nodes:[{}],originals:[v]})),src,tgt,origin,key,timeout,
    (err,translated)=>callback(err,translated&&translated.map(a=>a[0])));
 }
};
const ctx=vm.createContext({Date,Map,Set,WeakMap,console,setTimeout,clearTimeout,
 TWPUXPCache:{translatePieces(p,s,b,src,tgt,d,k,t,cb){p.translatePieces(b,src,tgt,d,k,t,cb)},
  translateMany(p,s,b,src,tgt,d,k,t,cb){p.translateMany(b,src,tgt,d,k,t,cb)},close(){}},
 TWPUXPProviders:{has(v){return ['google','deepl','bing'].includes(v)},get(){return provider}},
 TWPUXPPageTranslator:{collect(d){return d.nodes.map(n=>({nodes:[n],originals:[n.nodeValue]}))},
  prioritizeVisible(x){return x},apply(p,result,originals){const node=p.nodes[0],before=node.nodeValue;
   const after=result[0];originals.push({node,original:before,translated:after});node.nodeValue=after;return 1;}},
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return pref}}},interfaces:{nsIPrefBranch:{}}},
 gBrowser:{selectedBrowser:{get contentDocument(){return doc}},addEventListener(){},removeEventListener(){},
  tabContainer:{addEventListener(){},removeEventListener(){}}},
 document:{getElementById(id){if(id==='mainPopupSet')return {appendChild(){}};return null},
  createElement(){return {setAttribute(){},appendChild(){},addEventListener(){}}},getElementsByTagName(){return []}},
 window:{addEventListener(){},removeEventListener(){},alert(){}},
});
for(const name of ['pageController.js','selectionController.js','browserChrome.js','browser.js'])
 vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
(async()=>{
 doc=createDoc();const before=doc.nodes.map(n=>n.nodeValue);
 ctx.TWPUXP.translateCurrentPage();
 await pause(120);
 assert.equal(networkCalls,2,'rate limited request must prevent later page batches');
 assert.equal(doc.nodes[0].nodeValue,'Přeloženo');
 assert.equal(doc.nodes[1].nodeValue,before[1]);
 assert.equal(doc.nodes[2].nodeValue,before[2]);
 assert.match(doc.body.status.textContent,/Google has limited translation requests.*HTTP 429/);
 assert.match(doc.body.status.textContent,/91 seconds/);
 staleCallback();await pause(25);
 assert.deepEqual(doc.nodes.map(n=>n.nodeValue),['Přeloženo',before[1],before[2]]);
 ctx.TWPUXP.restoreCurrentPage();
 assert.deepEqual(doc.nodes.map(n=>n.nodeValue),before);
 console.log('PASS b3a6 page: localized 429 duration, dispatch stopped, ignored late callback, partial restore');
})().catch(e=>{console.error(e);process.exit(1)});
