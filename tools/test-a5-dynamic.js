'use strict';
// Node-only DOM simulation: source detection, page translation, dynamically
// appended content, script-modified text and cancellation/restore.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.join(__dirname,'..','uxp','chrome','content');
function el(tag, children=[], attributes={}) {
  let n={nodeType:1,nodeName:tag.toUpperCase(),firstChild:null,parentNode:null,nextSibling:null,
    isContentEditable:false,attributes,classList:{contains:()=>false},
    getAttribute:k=>Object.prototype.hasOwnProperty.call(attributes,k)?attributes[k]:null,
    getBoundingClientRect:()=>({top:20,bottom:60,width:200})};
  setKids(n,children); return n;
}
function setKids(parent,kids) {
  parent.firstChild=kids[0]||null;
  kids.forEach((kid,i)=>{kid.parentNode=parent;kid.nextSibling=kids[i+1]||null;});
}
function text(value){return {nodeType:3,nodeName:'#text',nodeValue:value,parentNode:null,nextSibling:null};}
const a=text('Hello first');const p1=el('p',[a]);const body=el('body',[p1]);
body.contains=function(n){while(n){if(n===this)return true;n=n.parentNode;}return false;};
const html=el('html',[],{lang:'en-US'}), elements={}, observers=[], history=[];
let calls=0;
const doc={body,documentElement:html,location:{protocol:'https:'},
  defaultView:{innerHeight:1000},
  querySelectorAll:()=>[],
  getElementById:k=>elements[k]||null,
  createElement:tag=> {
    if(tag==='textarea') {const o={value:''};Object.defineProperty(o,'innerHTML',{set(v){this.value=v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}});return o;}
    return {id:'',style:{cssText:''},setAttribute(){},textContent:'',parentNode:null};
  }
};
body.appendChild=function(e){e.parentNode=this;elements[e.id]=e;};
body.removeChild=function(e){e.parentNode=null;delete elements[e.id];};
class FakeObserver{
  constructor(cb){this.cb=cb;this.active=false;observers.push(this);}
  observe(){this.active=true;}
  disconnect(){this.active=false;}
  emit(changes){if(this.active)this.cb(changes);}
}
doc.defaultView.MutationObserver=FakeObserver;
const values={
  'extensions.twpuxp.from':'auto','extensions.twpuxp.to':'cs',
  'extensions.twpuxp.apiKey':'samplekey',
  'extensions.twpuxp.translateDynamicContent':true,
  'extensions.twpuxp.maxNodes':0,'extensions.twpuxp.useTwpParagraphEngine':true,
  'extensions.twpuxp.batchSize':8,'extensions.twpuxp.concurrentRequests':3,
  'extensions.twpuxp.timeoutMs':10000,'extensions.twpuxp.requestDelayMs':0
};
const pref={getCharPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 getBoolPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 getIntPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 setCharPref:(k,v)=>values[k]=v};
class FakeXHR{
  constructor(){this.status=200;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(requestBody) {
    calls++;
    const bodyJson=JSON.parse(requestBody);
    history.push({source:bodyJson[0][1],target:bodyJson[0][2]});
    this.responseText=JSON.stringify([bodyJson[0][0].map(()=>'<pre>Přeloženo</pre>'),[]]);
    setTimeout(()=>this.onload(),5);
  }
}
const ctx=vm.createContext({Map,Set,WeakMap,Date,Infinity,XMLHttpRequest:FakeXHR,
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>pref}},interfaces:{nsIPrefBranch:{}}},
  document:doc,gBrowser:{selectedBrowser:{contentDocument:doc}},
  window:{addEventListener(){},alert(){}},setTimeout,clearTimeout,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
require('./test-support/uxp-runtime').loadLegacyCache(ctx,base);
for(const file of ['googleProvider.js','bingProvider.js','deeplProvider.js','translationProviders.js','pageTranslator.js','pageAttributes.js','languageDetector.js','dynamicObserver.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test, time=2500) {for(let t=0;t<time;t+=20){if(test())return;await pause(20);}throw Error('test timeout: '+JSON.stringify({calls,a:a.nodeValue}));}
(async()=>{
  assert.strictEqual(ctx.TWPUXPLanguage.detect(doc),'en');
  assert.strictEqual(ctx.TWPUXPLanguage.normalize('zh-TW'),'zh-TW');
  assert.strictEqual(ctx.TWPUXPLanguage.normalize('es-MX'),'es');
  assert.strictEqual(ctx.TWPUXPLanguage.normalize('und'),null);
  ctx.TWPUXP.translateCurrentPage('auto','cs');
  await until(()=>a.nodeValue==='Přeloženo');
  assert.strictEqual(history[0].source,'en');
  assert.strictEqual(observers.length,1);
  const obs=observers[0];
  const prevCalls=calls;
  obs.emit([{type:'characterData',target:a}]);
  await pause(700);
  assert.strictEqual(calls,prevCalls,'Own translations must not be retransmitted');

  const b=text('Fresh news'); const p2=el('p',[b]);p1.nextSibling=p2;p2.parentNode=body;
  obs.emit([{type:'childList',addedNodes:[p2],removedNodes:[]}]);
  await until(()=>b.nodeValue==='Přeloženo');
  assert.strictEqual(calls,prevCalls+1,'New paragraph must be translated exactly once');

  a.nodeValue='Latest headline';
  obs.emit([{type:'characterData',target:a}]);
  await until(()=>a.nodeValue==='Přeloženo' && calls===prevCalls+2);
  ctx.TWPUXP.restoreCurrentPage();
  assert.strictEqual(a.nodeValue,'Latest headline','Restore must retain later author changes');
  assert.strictEqual(b.nodeValue,'Fresh news','Restore must undo added content translation');
  assert.strictEqual(obs.active,false,'Restore must stop observer');
  const afterRestoreCalls=calls;
  obs.emit([{type:'childList',addedNodes:[p2]}]);
  await pause(700);
  assert.strictEqual(calls,afterRestoreCalls,'No background translation after restore');
  console.log('PASS: language metadata, auto source, dynamic added nodes, self-update suppression, modified text, restore');
  process.exit(0); // Assertions are complete; discard mock browser's pending timer.
})().catch(e=>{console.error(e);process.exit(1);});
