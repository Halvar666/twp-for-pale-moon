'use strict';
// Integration simulation: >120 nodes, grouped HTML, three concurrent
// Bing/Edge requests and restore with original Google service untouched.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.join(__dirname,'..','uxp','chrome','content');
const texts=[], body={nodeType:1,nodeName:'BODY',firstChild:null,isContentEditable:false,
  classList:{contains:()=>false},getAttribute:()=>null};
let children=[];
for(let i=0;i<210;i++) {
  const elem={nodeType:1,nodeName:'P',isContentEditable:false,
    classList:{contains:()=>false},getAttribute:()=>null,
    getBoundingClientRect:()=>({top:i<4?30+i*50:1200+i*30,bottom:i<4?65+i*50:1230+i*30,width:300})};
  const node={nodeType:3,nodeName:'#text',nodeValue:'Hello number '+i,parentNode:elem,nextSibling:null};
  elem.firstChild=node;elem.parentNode=body;elem.nextSibling=null;texts.push(node);children.push(elem);
}
for(let i=0;i<children.length-1;i++)children[i].nextSibling=children[i+1];body.firstChild=children[0];
let elById={},outputs=[],getCount=0,active=0,maxActive=0,postCount=0;
const doc={body, location:{protocol:'https:'},defaultView:{innerHeight:900},
  getElementById:(k)=>elById[k]||null,
  createElement:(tag)=>{
    if(tag==='textarea') {
      let obj={value:''};Object.defineProperty(obj,'innerHTML',{set(v){this.value=v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}});return obj;
    }
    return {id:'',style:{cssText:''},setAttribute(){},textContent:'',parentNode:null};
  }
};
body.appendChild=function(el){el.parentNode=this;elById[el.id]=el;};
body.removeChild=function(el){el.parentNode=null;delete elById[el.id];};
const prefsVals={ 'extensions.twpuxp.from':'en','extensions.twpuxp.to':'cs',
  'extensions.twpuxp.translationService':'bing', 'extensions.twpuxp.maxNodes':0,'extensions.twpuxp.useTwpParagraphEngine':true,
  'extensions.twpuxp.batchSize':8,'extensions.twpuxp.concurrentRequests':3,
  'extensions.twpuxp.timeoutMs':20000,'extensions.twpuxp.requestDelayMs':0};
const prefs={getCharPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  getBoolPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  getIntPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  setCharPref:(k,v)=>prefsVals[k]=v};
class FakeXHR {
  constructor(){this.status=200;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(body){
    if(this.method==='GET') {
      throw Error('Bing provider must not request Google auth');
    }
    const items=JSON.parse(body);
    postCount++;active++;maxActive=Math.max(active,maxActive);
    setTimeout(()=>{
      this.responseText=JSON.stringify(items.map(()=>({translations:[{text:'<b10>Přeloženo</b10>'}]})));
      active--;this.onload();
    },12);
  }
}
class FakeDOMParser {
  parseFromString(html,type){
    const found=/<b10>(.*?)<\/b10>/i.exec(html);
    if(!found)throw Error('Missing mocked Bing indexed tag');
    return {body:{childNodes:[{nodeType:1,nodeName:'B10',textContent:found[1]}],textContent:found[1]}};
  }
}
const ctx=vm.createContext({Map,WeakMap,Date,Infinity,XMLHttpRequest:FakeXHR,DOMParser:FakeDOMParser,
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>prefs}},interfaces:{nsIPrefBranch:{}}},
  document:doc,gBrowser:{selectedBrowser:{contentDocument:doc}},
  window:{addEventListener(){},alert(){}},
  setTimeout,clearTimeout,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
require('./test-support/uxp-runtime').loadLegacyCache(ctx,base);
for(const file of ['googleProvider.js','bingProvider.js','deeplProvider.js','translationProviders.js','pageTranslator.js','pageAttributes.js','languageDetector.js','dynamicObserver.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
const pieces=ctx.TWPUXPPageTranslator.collect(doc,0);
assert.strictEqual(pieces.length,210,'Full collector must have no 120-node cutoff');
ctx.TWPUXP.translateCurrentPage('en','cs');
const deadline=Date.now()+3500;
const check=()=>{
  if(texts.every(t=>t.nodeValue==='Přeloženo')) {
    assert.strictEqual(getCount,0,'Bing must not use Google authorization');
    assert(maxActive>1 && maxActive<=3,'parallel calls must be capped to 3');
    ctx.TWPUXP.restoreCurrentPage();
    assert(texts.every((t,i)=>t.nodeValue==='Hello number '+i),'restore entire page');
    console.log('PASS a8 Bing integration: 210/210 nodes, concurrent='+maxActive+', POSTs='+postCount+', auth GET='+getCount+', restore');
    process.exit(0);
  }
  if(Date.now()>deadline){console.error('Timed out, translated='+texts.filter(t=>t.nodeValue==='Přeloženo').length);process.exit(1);}
  setTimeout(check,25);
};
check();
