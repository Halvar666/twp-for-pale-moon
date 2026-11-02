/* MPL-2.0: Bing provider protocol fixture tests. Does NOT call Microsoft servers. */
'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const ROOT=path.join(__dirname,'..','uxp','chrome','content');
let nReq=0, requests=[];
function decode(s) {return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');}
function fakeParseHTML(html) {
  const nodes=[];let last=0;const tags=/<(b\d+)>([\s\S]*?)<\/\1>/gim;let m;
  while((m=tags.exec(html))) {
    if(m.index>last)nodes.push({nodeType:3,textContent:decode(html.slice(last,m.index))});
    nodes.push({nodeType:1,nodeName:m[1].toUpperCase(),textContent:decode(m[2])});
    last=tags.lastIndex;
  }
  if(last<html.length)nodes.push({nodeType:3,textContent:decode(html.slice(last))});
  return {body:{childNodes:nodes,textContent:nodes.map(n=>n.textContent).join('')}};
}
class FakeDOMParser {parseFromString(str,type){assert.strictEqual(type,'text/html');return fakeParseHTML(str);}}
class FakeXHR {
  constructor(){this.status=200;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(payload){
    assert.strictEqual(this.method,'POST');
    assert.strictEqual(this.headers['Content-Type'],'application/json');
    const incoming=JSON.parse(payload);nReq++;
    requests.push({url:this.url,incoming});
    // Reverse markup order to test the index-based TWP/Bing mapping.
    const outputs=incoming.map(text=>({translations:[{text:[...text.matchAll(/<b\d+>[\s\S]*?<\/b\d+>/gi)]
      .reverse().map(m=>m[0].replace(/(>)([^<]*)(<\/b)/,'$1CZ:$2$3')).join('')}]}));
    this.responseText=JSON.stringify(outputs);
    setImmediate(()=>this.onload());
  }
}
const ctx=vm.createContext({Map,Date,XMLHttpRequest:FakeXHR,DOMParser:FakeDOMParser,
  encodeURIComponent,JSON,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
for(const file of ['bingProvider.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),ctx,{filename:file});
const bing=ctx.TWPBingProvider;
assert.strictEqual(bing.normalizeLanguage('auto'),'auto-detect');
assert.strictEqual(bing.normalizeLanguage('zh-CN'),'zh-Hans');
assert.strictEqual(bing.normalizeLanguage('zh-TW'),'zh-Hant');
assert.strictEqual(bing.normalizeLanguage('sr'),'sr-Cyrl');
const pieces=[
  {nodes:[{},{}],originals:['Hello ','world & beyond']},
  {nodes:[{}],originals:['A simple text']}
];
function translate(ps,from,to){return new Promise((resolve,reject)=>bing.translatePieces(ps,from,to,{},null,3000,(e,r)=>e?reject(e):resolve(r)));}
(async()=>{
 const output=await translate(pieces,'auto','cs');
 assert.strictEqual(output[0][0],'CZ:Hello ');
 assert.strictEqual(output[0][1],'CZ:world & beyond');
 assert.strictEqual(output[1][0],'CZ:A simple text');
 assert.strictEqual(nReq,1,'One batched request expected');
 assert.strictEqual(requests[0].url.includes('&from='),false,'auto must omit source language');
 assert(requests[0].url.endsWith('&to=cs'));
 assert(requests[0].incoming[0].includes('world &amp; beyond'),'HTML should be escaped');
 const cached=await translate(pieces,'auto','cs');
 assert.strictEqual(cached[0][0],'CZ:Hello ');
 assert.strictEqual(nReq,1,'Cached request must not resend');
 const single=await new Promise((resolve,reject)=>bing.translateMany(['Hello world'],'zh-CN','zh-TW',{},null,3000,(e,r)=>e?reject(e):resolve(r)));
 assert.strictEqual(single[0],'CZ:Hello world');
 assert(requests[1].url.includes('&from=zh-Hans&to=zh-Hant'));
 let rejected=false;
 try {bing.decodeResult('<b10>Only one</b10>',2,{});}catch(e){rejected=true;}
 assert(rejected,'Missing second indexed segment must fail');
 console.log('PASS a8 Bing: JSON protocol, reordering, escaping, language code mapping, caching, count validation');
})().catch(e=>{console.error(e);process.exit(1)});
