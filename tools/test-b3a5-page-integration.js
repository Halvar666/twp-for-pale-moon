/* MPL-2.0. b3a5 end-to-end page translation with protected dictionary terms. */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.join(__dirname,'..','uxp','chrome','content');
const texts=[], body={nodeType:1,nodeName:'BODY',firstChild:null,isContentEditable:false,
  classList:{contains:()=>false},getAttribute:()=>null};
let children=[];
for(let i=0;i<210;i++) {
  const elem={nodeType:1,nodeName:'P',isContentEditable:false,
    classList:{contains:()=>false},getAttribute:()=>null,
    getBoundingClientRect:()=>({top:1200+i*30,bottom:1230+i*30,width:300})};
  const node={nodeType:3,nodeName:'#text',nodeValue:'Hello '+i,parentNode:elem,nextSibling:null};
  elem.firstChild=node;elem.parentNode=body;elem.nextSibling=null;texts.push(node);children.push(elem);
}
for(let i=0;i<children.length-1;i++)children[i].nextSibling=children[i+1];body.firstChild=children[0];
let elById={},getCount=0,postCount=0,failedOnce=false,lastSentProtected=false;
const doc={body,location:{protocol:'https:'},defaultView:{innerHeight:900},
  getElementById:k=>elById[k]||null,
  createElement:tag=>{
    if(tag==='textarea'){let o={value:''};Object.defineProperty(o,'innerHTML',{set(v){this.value=v;}});return o;}
    return {id:'',style:{cssText:''},setAttribute(){},textContent:'',parentNode:null};
  }};
body.appendChild=el=>{el.parentNode=body;elById[el.id]=el};
body.removeChild=el=>{el.parentNode=null;delete elById[el.id]};
const vals={'extensions.twpuxp.from':'en','extensions.twpuxp.to':'cs',
 'extensions.twpuxp.translationService':'google','extensions.twpuxp.maxNodes':0,
 'extensions.twpuxp.useTwpParagraphEngine':true,'extensions.twpuxp.batchSize':8,
 'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':20000,
 'extensions.twpuxp.requestDelayMs':0,'extensions.twpuxp.translateDynamicContent':false,
 'extensions.twpuxp.showPageProgress':true};
const prefs={getCharPref:k=>{if(!(k in vals))throw Error(k);return vals[k]},
 getBoolPref:k=>{if(!(k in vals))throw Error(k);return vals[k]},
 getIntPref:k=>{if(!(k in vals))throw Error(k);return vals[k]},
 setCharPref:(k,v)=>vals[k]=v};
class MockXHR {
  constructor(){this.status=200;}
  open(method,url){this.method=method;}
  setRequestHeader(){}
  send(body){
    if(this.method==='GET'){
      getCount++;this.responseText='"x-goog-api-key":"'+'A'.repeat(39)+'"';
      return setImmediate(()=>this.onload());
    }
    postCount++;
    const items=JSON.parse(body)[0][0];
    if(items.some(x=>x.includes("Hello") || x.includes("Zdravím"))) lastSentProtected=true;
    if(!failedOnce && postCount===3){failedOnce=true;this.status=502;return setImmediate(()=>this.onload());}
    this.responseText=JSON.stringify([items.map(()=>'<pre>Přeloženo</pre>'),[]]);
    setImmediate(()=>this.onload());
  }
}
const fastTimer=(cb,delay)=>setTimeout(cb,(delay===650||delay===1600)?0:delay);
const ctx=vm.createContext({Map,WeakMap,Set,Date,Infinity,XMLHttpRequest:MockXHR,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>prefs}},interfaces:{nsIPrefBranch:{}}},
 document:doc,gBrowser:{selectedBrowser:{contentDocument:doc}},window:{addEventListener(){},alert(){}},
 setTimeout:fastTimer,clearTimeout,console});
// Shared fixture supplies the actual a19+ cache implementation in disabled mode.
require('./test-support/uxp-runtime').loadLegacyCache(ctx,base);
// Provider protocol is tested separately from the a26 privacy transport.
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
for(const f of ['googleProvider.js','bingProvider.js','deeplProvider.js','translationProviders.js','pageTranslator.js','pageAttributes.js','languageDetector.js',
'dynamicObserver.js','autoRules.js','languageCatalog.js','customDictionary.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx,{filename:f});
vals['extensions.twpuxp.customDictionary'] = ctx.TWPUXPCustomDictionary.encode('Hello => Zdravím');
ctx.TWPUXP.translateCurrentPage('en','cs');
const deadline=Date.now()+5000;
(function check(){
 if(texts.every(t=>t.nodeValue==='Zdravím Přeloženo') && elById['twpuxp-status-message'] && elById['twpuxp-status-message'].textContent.includes('Finished')){
   assert.strictEqual(getCount,1);assert(failedOnce);assert(postCount>4);
   assert(!lastSentProtected, 'protected terms were sent to Google');
   assert(elById['twpuxp-status-message'].textContent.includes('Finished'));
   ctx.TWPUXP.restoreCurrentPage();
   assert(texts.every((t,i)=>t.nodeValue==='Hello '+i));
   console.log('PASS b3a5 page: 210 protected replacements + Google 502 retry + restore');return;
 }
 if(Date.now()>deadline){console.error('TIMEOUT '+texts.filter(t=>t.nodeValue==='Zdravím Přeloženo').length);process.exitCode=1;return;}
 setTimeout(check,10);
})();
