/* MPL-2.0: b2a2 regression for Google's indexed-PRE contract.
 * The b2a1 synthetic pieces lacked nodes[], unlike the ordinary DOM pieces.
 * Exercise the actual Google adapter, not a permissive provider stub.
 */
'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const base=path.resolve(__dirname,'../chrome/content');
function el(tag,children=[],attrs={}) {
 const e={nodeType:1,nodeName:tag.toUpperCase(),firstChild:null,parentNode:null,nextSibling:null,
  isContentEditable:false,classList:{contains:()=>false},getAttribute:k=>attrs[k]||null,
  getBoundingClientRect:()=>({top:0,bottom:900,width:700})};
 children.forEach((c,i)=>{c.parentNode=e;c.nextSibling=children[i+1]||null;});
 e.firstChild=children[0]||null;return e;
}
const text='\n\nv2.5\n・[update] brotli を v1.2.1 へ更新\n・[update] OpenSSL を v3.5.9 へ更新\n\nv2.4\n'+
 Array.from({length:40},(_,i)=>'・[change] 日本語の更新履歴 '+i).join('\n')+'\n\n';
assert(text.length>780,'fixture must reproduce a long README PRE');
const node={nodeType:3,nodeName:'#text',nodeValue:text,nextSibling:null,parentNode:null};
const pre=el('pre',[node]);const body=el('body',[pre]);
body.contains=function(n){for(;n;n=n.parentNode)if(n===body)return true;return false;};
const elements={};
body.appendChild=x=>{x.parentNode=body;elements[x.id]=x};
body.removeChild=x=>{x.parentNode=null;delete elements[x.id]};
const doc={body,location:{protocol:'https:',hostname:'github.com'},
 documentElement:el('html',[],{lang:'en'}),defaultView:{innerHeight:1000},
 querySelectorAll(){return []},getElementById:k=>elements[k]||null,
 createElement(tag){if(tag==='textarea')return {set innerHTML(x){this.value=x.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')},value:''};
  return {id:'',textContent:'',style:{cssText:''},setAttribute(){},parentNode:null};}};
const settings={'extensions.twpuxp.from':'auto','extensions.twpuxp.to':'en',
 'extensions.twpuxp.translationService':'google','extensions.twpuxp.maxNodes':0,
 'extensions.twpuxp.useTwpParagraphEngine':true,'extensions.twpuxp.batchSize':8,
 'extensions.twpuxp.concurrentRequests':3,'extensions.twpuxp.timeoutMs':20000,
 'extensions.twpuxp.requestDelayMs':0,'extensions.twpuxp.translateDynamicContent':false};
const prefs={getCharPref:k=>{if(!(k in settings))throw Error(k);return settings[k]},
 getBoolPref:k=>{if(!(k in settings))throw Error(k);return settings[k]},
 getIntPref:k=>{if(!(k in settings))throw Error(k);return settings[k]},
 setCharPref:(k,v)=>{settings[k]=v}};
let getCount=0, postCount=0, received=[];
class FakeXHR {
 constructor(){this.status=200;this.headers={}};
 setRequestHeader(k,v){this.headers[k]=v};
 send(body){
  if(!body){getCount++;this.responseText='"x-goog-api-key":"'+'A'.repeat(39)+'"';return setImmediate(()=>this.onload())}
  postCount++;
  const json=JSON.parse(body),chunks=json[0][0];
  assert.strictEqual(json[0][1],'auto','mixed-language GitHub page must be delegated to provider');
  for(const chunk of chunks)assert(!/[\r\n]/.test(chunk),'layout separators must stay local');
  received.push(...chunks);
  this.responseText=JSON.stringify([chunks.map(p=>p.replace(/^<pre>/,'<pre>Translated ')),[]]);
  setImmediate(()=>this.onload());
 }
}
const ctx=vm.createContext({console,Map,Set,WeakMap,Date,Infinity,setTimeout,clearTimeout,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return prefs}}},interfaces:{nsIPrefBranch:{}}},
 window:{addEventListener(){},alert(x){throw Error(x)}},
 document:{getElementById(){return null},getElementsByTagName(){return []}},
 gBrowser:{selectedBrowser:{contentDocument:doc}},
 TWPUXPPrivacyXHR:{create(method){const r=new FakeXHR();r.method=method;return r}},
 TWPUXPAttributes:{collect(){return []}},TWPUXPOriginalHover:{start(){},remember(){},stop(){}},
 TWPUXPDynamic:{watch(){throw Error('unexpected dynamic observer')}}});
const scripts=['textLayout.js','languageDetector.js','googleProvider.js','bingProvider.js','deeplProvider.js','translationProviders.js',
 'pageTranslator.js','pageController.js','selectionController.js','browserChrome.js','browser.js'];
for(const name of scripts) vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),ctx,{filename:name});
// Don't hide the provider contract by mocking translatePieces. Only the disk
// cache wrapper is replaced (persistent cache is off by default).
ctx.TWPUXPCache={translatePieces(provider,service,chunk,src,tgt,d,key,timeout,cb){
 provider.translatePieces(chunk,src,tgt,d,key,timeout,cb);
},close(){}};
ctx.TWPUXP.translateCurrentPage('auto','en');
(async()=>{
 const deadline=Date.now()+1800;
 while(Date.now()<deadline && node.nodeValue===text && !String(elements['twpuxp-status-message']?.textContent||'').includes('Stopped'))
  await new Promise(r=>setTimeout(r,5));
 const status=String(elements['twpuxp-status-message']?.textContent||'');
 assert(!status.includes('Stopped'), 'Google must not abort PRE translation: '+status);
 assert.notStrictEqual(node.nodeValue,text,'Japanese PRE must be translated');
 assert(postCount>=2,'long block must dispatch multiple Google calls');
 assert.strictEqual((node.nodeValue.match(/\n/g)||[]).length,(text.match(/\n/g)||[]).length,
  'newlines and blank lines must survive');
 assert(node.nodeValue.includes('Translated '),'real Google response was not processed');
 ctx.TWPUXP.restoreCurrentPage();
 assert.strictEqual(node.nodeValue,text,'original PRE restore must be lossless');
 console.log('PASS b2a2 real Google adapter: PRE segmented requests / layout / restore / auto source; '+postCount+' POST calls, '+getCount+' auth GET');
})().catch(e=>{console.error(e);process.exitCode=1});
