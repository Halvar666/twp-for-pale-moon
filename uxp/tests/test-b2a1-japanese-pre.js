/* 1.0.0b2a1 regression: Japanese Proxydomo-style GitHub README section. */
'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const base=path.resolve(__dirname,'../chrome/content');
function element(tag,children=[],attrs={}) {
 const e={nodeType:1,nodeName:tag.toUpperCase(),firstChild:null,parentNode:null,nextSibling:null,
   isContentEditable:false,classList:{contains:()=>false},getAttribute:k=>attrs[k]||null,
   getBoundingClientRect:()=>({top:0,bottom:900,width:700})};
 children.forEach((x,i)=>{x.parentNode=e;x.nextSibling=children[i+1]||null;});
 e.firstChild=children[0]||null;return e;
}
function txt(value) {return {nodeType:3,nodeName:'#text',nodeValue:value,parentNode:null,nextSibling:null};}
// The linked README's section is a single long text node inside <pre>.
const original='\n\nv2.5\n・[update] brotli を v1.2.1 へ更新 (脆弱性対応)\n・[update] OpenSSL を v3.5.9 へ更新\n\nv2.4\n'+
 Array.from({length:24},(_,i)=>'・[change] 接続モニターのタイトルバーで日本語の履歴 '+i).join('\n')+'\n\n';
assert(original.length>780);
const node=txt(original), pre=element('pre',[node]), body=element('body',[pre]);
body.contains=function(n) {for(;n;n=n.parentNode)if(n===body)return true;return false;};
const elements={};
body.appendChild=function(x){x.parentNode=body;elements[x.id]=x;};
body.removeChild=function(x){x.parentNode=null;delete elements[x.id];};
const doc={body,location:{protocol:'https:',hostname:'github.com'},
 documentElement:element('html',[],{lang:'en'}),defaultView:{innerHeight:1000},
 querySelectorAll(){return []},getElementById(id){return elements[id]||null},
 createElement(tag){if(tag==='textarea')return {innerHTML:'',value:''};
   return {id:'',textContent:'',style:{cssText:''},setAttribute(){},parentNode:null};}};
let seen=[],calls=0;
const provider={translatePieces(pieces,from,to,doc,key,timeout,cb){
 calls++;seen.push({source:from,segments:pieces.map(p=>p.originals[0])});
 cb(null,pieces.map(p=>p.originals.map(x=>'T'+x)));
}};
const values={'extensions.twpuxp.from':'auto','extensions.twpuxp.to':'en',
 'extensions.twpuxp.translationService':'google','extensions.twpuxp.maxNodes':0,
 'extensions.twpuxp.useTwpParagraphEngine':true,'extensions.twpuxp.batchSize':8,
 'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':20000,
 'extensions.twpuxp.requestDelayMs':0,'extensions.twpuxp.translateDynamicContent':false};
const pref={getCharPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 getBoolPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 getIntPref:k=>{if(!(k in values))throw Error(k);return values[k];},
 setCharPref:(k,v)=>values[k]=v};
const ctx=vm.createContext({console,Map,Set,WeakMap,Date,Infinity,setTimeout,clearTimeout,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return pref}}},interfaces:{nsIPrefBranch:{}}},
 window:{addEventListener(){},alert(x){throw Error(x)}},
 document:{getElementById(){return null},getElementsByTagName(){return []}},
 gBrowser:{selectedBrowser:{contentDocument:doc}},
 TWPUXPProviders:{has(n){return n==='google'},get(n){return provider}},
 TWPUXPCache:{translatePieces(p,s,b,src,tgt,d,k,t,cb){return p.translatePieces(b,src,tgt,d,k,t,cb)},close(){}},
 TWPUXPAttributes:{collect(){return []}},TWPUXPOriginalHover:{start(){},remember(){},stop(){}},
 TWPUXPDynamic:{watch(){throw Error('no dynamic observer expected')}},
 TWPUXPAutoRules:{}});
for(const f of ['textLayout.js','languageDetector.js','pageTranslator.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
 vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),ctx,{filename:f});
ctx.TWPUXP.translateCurrentPage('auto','en');
const pause=t=>new Promise(r=>setTimeout(r,t));
(async()=>{
 for(let i=0;i<120;i++) {if(node.nodeValue!==original&&node.nodeValue.includes('Tv2.5'))break;await pause(10);}
 assert.notStrictEqual(node.nodeValue,original,'README section was not translated');
 assert(seen.length>=2,'long pre block must be sent in bounded translation batches');
 assert(seen.every(b=>b.source==='auto'),'Japanese contents must not be translated from HTML-en');
 assert(seen.every(b=>b.segments.every(t=>!/[\r\n]/.test(t))),'linebreaks must not go to provider');
 assert.strictEqual((node.nodeValue.match(/\n/g)||[]).length,(original.match(/\n/g)||[]).length);
 assert(node.nodeValue.includes('\n\nv2.4\n')===false,'translated lines should be changed');
 assert(node.nodeValue.includes('\n\nTv2.4\n'),'blank line before version must remain');
 ctx.TWPUXP.restoreCurrentPage();
 assert.strictEqual(node.nodeValue,original,'original pre content must restore byte-for-byte');
 console.log('PASS b2a1 GitHub Japanese PRE: auto-detect, line layout, bounded requests and restore');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
