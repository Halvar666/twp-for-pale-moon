'use strict';
// Integration simulation for TWP UXP a15: attributes, same-origin frames,
// cross-origin exclusion, dynamic attributes/frame text and complete rollback.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const base=path.join(__dirname,'..','uxp','chrome','content');
const observers=[];
function element(name, attr={}, kids=[]) {
  let n={nodeType:1,nodeName:name.toUpperCase(),parentNode:null,nextSibling:null,
    firstChild:null,attrs:Object.assign({},attr),isContentEditable:false,
    classList:{contains:()=>false},
    getAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k)?this.attrs[k]:null;},
    hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k);},
    setAttribute(k,v){this.attrs[k]=String(v);},
    getBoundingClientRect:()=>({top:20,bottom:50,width:200})};
  link(n,kids);
  return n;
}
function text(v){return {nodeType:3,nodeName:'#text',nodeValue:v,nextSibling:null,parentNode:null};}
function link(parent,kids){parent.firstChild=kids[0]||null;kids.forEach((n,i)=>{n.parentNode=parent;n.nextSibling=kids[i+1]||null;});}
function contains(n){for(;n;n=n.parentNode)if(n===this)return true;return false;}
const mainText=text('Hello main'),frameText=text('Hello frame'),foreignText=text('Do not send me');
const p=element('p',{},[mainText]);
const img=element('img',{alt:'Beautiful mountain',title:'Preview image'});
const field=element('input',{type:'text',placeholder:'Write here'});
const childP=element('p',{},[frameText]);
const foreignP=element('p',{},[foreignText]);
const iframe=element('iframe'),foreignFrame=element('iframe');
const mainBody=element('body',{},[p,img,field,iframe,foreignFrame]);
const frameBody=element('body',{},[childP]);
const foreignBody=element('body',{},[foreignP]);
for(const b of [mainBody,frameBody,foreignBody])b.contains=contains;
class Observer{
  constructor(cb){this.cb=cb;this.active=false;observers.push(this);}
  observe(body){this.active=true;this.body=body;}
  disconnect(){this.active=false;}
  emit(events){if(this.active)this.cb(events);}
}
function documentFor(body,hostname) {
  const statusEls={};
  const d={body,location:{protocol:'https:',hostname,port:''},
    documentElement:element('html',{lang:'en'}),
    defaultView:{innerHeight:700,MutationObserver:Observer},
    getElementById:k=>statusEls[k]||null,
    createElement(tag){
      if(tag==='textarea') {
        const t={value:''}; Object.defineProperty(t,'innerHTML',{set(v){this.value=v.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}});
        return t;
      }
      return {id:'',style:{cssText:''},textContent:'',setAttribute(){},parentNode:null};
    },
    querySelectorAll(query){return query==='iframe,frame'?(body===mainBody?[iframe,foreignFrame]:[]):[];}
  };
  body.appendChild=function(el){el.parentNode=body;statusEls[el.id]=el;};
  body.removeChild=function(el){el.parentNode=null;delete statusEls[el.id];};
  function mark(n){n.ownerDocument=d;for(let c=n.firstChild;c;c=c.nextSibling)mark(c);}
  mark(body);
  return d;
}
const doc=documentFor(mainBody,'example.org');
const childDoc=documentFor(frameBody,'example.org');
const foreignDoc=documentFor(foreignBody,'different.org');
iframe.contentDocument=childDoc; foreignFrame.contentDocument=foreignDoc;
const vals={'extensions.twpuxp.from':'en','extensions.twpuxp.to':'cs',
  'extensions.twpuxp.translateIframes':true,'extensions.twpuxp.translatePageAttributes':true,
  'extensions.twpuxp.translateDynamicContent':true,'extensions.twpuxp.useTwpParagraphEngine':true,
  'extensions.twpuxp.maxNodes':0,'extensions.twpuxp.batchSize':8,
  'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':20000,
  'extensions.twpuxp.requestDelayMs':0,'extensions.twpuxp.apiKey':'key'};
const pref={getCharPref:k=>{if(!(k in vals))throw Error(k);return vals[k];},
  getBoolPref:k=>{if(!(k in vals))throw Error(k);return vals[k];},
  getIntPref:k=>{if(!(k in vals))throw Error(k);return vals[k];},
  setCharPref:(k,v)=>vals[k]=v};
let requestCount=0;
class XHR {
  constructor(){this.status=200;}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(){}
  send(payload){
    if(this.method==='GET')throw Error('Unexpected auth GET');
    const strings=JSON.parse(payload)[0][0];requestCount++;
    this.responseText=JSON.stringify([strings.map(()=>'<pre>Přeloženo</pre>'),[]]);
    setTimeout(()=>this.onload(),3);
  }
}
const ctx=vm.createContext({Map,Set,WeakMap,Date,Infinity,XMLHttpRequest:XHR,
  Components:{classes:{'@mozilla.org/preferences-service;1':{getService:()=>pref}},interfaces:{nsIPrefBranch:{}}},
  document:doc,gBrowser:{selectedBrowser:{contentDocument:doc}},
  window:{addEventListener(){},alert(){}},setTimeout,clearTimeout,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
require('./test-support/uxp-runtime').loadLegacyCache(ctx,base);
for(const file of ['googleProvider.js','bingProvider.js','deeplProvider.js',
    'translationProviders.js','pageTranslator.js','pageAttributes.js',
    'languageDetector.js','dynamicObserver.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
async function until(fn){for(let i=0;i<110;i++){if(fn())return;await wait(25);}throw Error('Timeout waiting for translation '+JSON.stringify({attr:field.getAttribute('placeholder'),main:mainText.nodeValue,frame:frameText.nodeValue,requests:requestCount,status:doc.getElementById('twpuxp-status-message')&&doc.getElementById('twpuxp-status-message').textContent}));}
(async()=>{
  const attrs=ctx.TWPUXPAttributes.collect(doc);
  assert.strictEqual(attrs.length,3,'Only eligible main-page attrs should be returned');
  assert.deepStrictEqual(Array.from(attrs.map(p=>p.nodes[0].attributeName)),['title','alt','placeholder']);
  ctx.TWPUXP.translateCurrentPage('en','cs');
  await until(()=>mainText.nodeValue==='Přeloženo' && frameText.nodeValue==='Přeloženo' &&
    img.getAttribute('alt')==='Přeloženo' && field.getAttribute('placeholder')==='Přeloženo');
  assert.strictEqual(foreignText.nodeValue,'Do not send me','Foreign iframe must be excluded');
  assert.strictEqual(observers.filter(o=>o.active).length,2,'Top and same-origin frame observed');
  assert(requestCount>0);
  // No duplicate requests for attribute changes caused by the addon itself.
  const unchangedCalls=requestCount;
  observers.find(o=>o.body===mainBody).emit([{type:'attributes',target:field,attributeName:'placeholder'}]);
  await wait(700);
  assert.strictEqual(requestCount,unchangedCalls,'Self-written attrs must not retranslate');
  field.setAttribute('placeholder','Fresh placeholder');
  const topObserver=observers.find(o=>o.body===mainBody);
  topObserver.emit([{type:'attributes',target:field,attributeName:'placeholder'}]);
  await until(()=>field.getAttribute('placeholder')==='Přeloženo');
  const newText=text('Fresh frame news');const newP=element('p',{},[newText]);
  childP.nextSibling=newP;newP.parentNode=frameBody;newText.ownerDocument=childDoc;newP.ownerDocument=childDoc;
  const childObserver=observers.find(o=>o.body===frameBody);
  childObserver.emit([{type:'childList',addedNodes:[newP],removedNodes:[]}]);
  await until(()=>newText.nodeValue==='Přeloženo');
  ctx.TWPUXP.restoreCurrentPage();
  assert.strictEqual(mainText.nodeValue,'Hello main');
  assert.strictEqual(frameText.nodeValue,'Hello frame');
  assert.strictEqual(newText.nodeValue,'Fresh frame news');
  assert.strictEqual(img.getAttribute('alt'),'Beautiful mountain');
  assert.strictEqual(img.getAttribute('title'),'Preview image');
  assert.strictEqual(field.getAttribute('placeholder'),'Fresh placeholder');
  assert.strictEqual(foreignText.nodeValue,'Do not send me');
  assert(observers.every(o=>!o.active),'Restore must stop all frame observers');
  console.log('PASS a15: attributes, same-origin frame, foreign excluded, dynamic attributes/frame and rollback; requests='+requestCount);
  process.exit(0); // Assertions are complete; discard mock browser's pending timer.
})().catch(e=>{console.error(e);process.exitCode=1;});
