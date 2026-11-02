/* MPL-2.0. Full-page Bing missing-index recovery regression.
   Simulates the exact user-observed failure within a long page. */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.join(__dirname,'..','uxp','chrome','content');
const texts=[], body={nodeType:1,nodeName:'BODY',firstChild:null,isContentEditable:false,
  classList:{contains:()=>false},getAttribute:()=>null};
const children=[];
for(let i=0;i<210;i++) {
  const elem={nodeType:1,nodeName:'P',isContentEditable:false,
    classList:{contains:()=>false},getAttribute:()=>null,
    getBoundingClientRect:()=>({top:i<4?30+i*50:1200+i*30,bottom:i<4?65+i*50:1230+i*30,width:300})};
  const count=(i===125)?3:1; // malformed Bing response after ~125 nodes
  let nodes=[];
  for(let j=0;j<count;j++) {
    const node={nodeType:3,nodeName:'#text',nodeValue:'Hello '+i+'_'+j,parentNode:elem,nextSibling:null};
    nodes.push(node);texts.push(node);
  }
  for(let j=0;j<nodes.length-1;j++)nodes[j].nextSibling=nodes[j+1];
  elem.firstChild=nodes[0];elem.parentNode=body;elem.nextSibling=null;children.push(elem);
}
for(let i=0;i<children.length-1;i++)children[i].nextSibling=children[i+1];body.firstChild=children[0];
const originals=texts.map(t=>t.nodeValue);
let elById={},active=0,maxActive=0,postCount=0, malformed=0, individualRetry=false;
const doc={body, location:{protocol:'https:'},defaultView:{innerHeight:900},
  getElementById:(k)=>elById[k]||null,
  createElement:(tag)=>{
    if(tag==='textarea') {let obj={value:''};Object.defineProperty(obj,'innerHTML',
      {set(v){this.value=v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}});return obj;}
    return {id:'',style:{cssText:''},setAttribute(){},textContent:'',parentNode:null};
  }
};
body.appendChild=function(el){el.parentNode=this;elById[el.id]=el;};
body.removeChild=function(el){el.parentNode=null;delete elById[el.id];};
const prefsVals={'extensions.twpuxp.from':'en','extensions.twpuxp.to':'cs',
  'extensions.twpuxp.translationService':'bing','extensions.twpuxp.maxNodes':0,
  'extensions.twpuxp.useTwpParagraphEngine':true,'extensions.twpuxp.batchSize':8,
  'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':20000,
  'extensions.twpuxp.requestDelayMs':0};
const prefs={getCharPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  getBoolPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  getIntPref:k=>{if(!(k in prefsVals))throw Error('missing');return prefsVals[k];},
  setCharPref:(k,v)=>prefsVals[k]=v};
class FakeXHR {
  constructor(){this.status=200;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(payload){
    assert.strictEqual(this.method,'POST');
    postCount++;active++;maxActive=Math.max(active,maxActive);
    const items=JSON.parse(payload);
    const bodies=items.map(item=>{
      const segments=[...item.matchAll(/<b(\d+)>[\s\S]*?<\/b\1>/gi)];
      if(segments.length===3 && !malformed) {
        malformed++;
        return '<b10>Přeloženo</b10><b12>Přeloženo</b12>';
      }
      if(individualRetry || malformed && segments.length===1 && item.includes('_')) individualRetry=true;
      return segments.map(s=>`<b${s[1]}>Přeloženo</b${s[1]}>`).join('');
    });
    setTimeout(()=>{this.responseText=JSON.stringify(bodies.map(text=>({translations:[{text}]})));
      active--;this.onload();},4);
  }
}
class FakeDOMParser {
  parseFromString(html,type){
    assert.strictEqual(type,'text/html');const nodes=[];let last=0;
    const re=/<(b\d+)>([\s\S]*?)<\/\1>/gi;let match;
    while((match=re.exec(html))){
      if(match.index>last)nodes.push({nodeType:3,textContent:html.slice(last,match.index)});
      nodes.push({nodeType:1,nodeName:match[1].toUpperCase(),textContent:match[2]});last=re.lastIndex;
    }
    if(last<html.length)nodes.push({nodeType:3,textContent:html.slice(last)});
    return {body:{childNodes:nodes,textContent:nodes.map(n=>n.textContent).join('')}};
  }
}
const ctx=vm.createContext({Map,WeakMap,Date,Infinity,XMLHttpRequest:FakeXHR,DOMParser:FakeDOMParser,
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>prefs}},
    interfaces:{nsIPrefBranch:{}}},document:doc,gBrowser:{selectedBrowser:{contentDocument:doc}},
  window:{addEventListener(){},alert(){}},setTimeout,clearTimeout,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
require('./test-support/uxp-runtime').loadLegacyCache(ctx,base);
for(const file of ['googleProvider.js','bingProvider.js','deeplProvider.js','translationProviders.js',
  'pageTranslator.js','pageAttributes.js','languageDetector.js','dynamicObserver.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
ctx.TWPUXP.translateCurrentPage('en','cs');
const deadline=Date.now()+6000;
function check(){
  if(texts.every(t=>t.nodeValue==='Přeloženo')){
    assert.strictEqual(malformed,1,'One 3-segment response should be malformed');
    assert(individualRetry,'Bing must retry affected group as single-node items');
    assert(maxActive<=3,'Must not exceed existing concurrency');
    ctx.TWPUXP.restoreCurrentPage();
    assert(texts.every((t,i)=>t.nodeValue===originals[i]),'Restore original after fallback');
    console.log('PASS a9 Bing integration: '+texts.length+'/'+texts.length+' nodes, '+postCount+' requests, 1 recovered malformed group, restore');
    process.exit(0);
  }
  if(Date.now()>deadline){console.error('TIMEOUT: '+texts.filter(t=>t.nodeValue==='Přeloženo').length+'/'+texts.length+' nodes');process.exit(1);}
  setTimeout(check,20);
}
check();
