/* MPL-2.0. Regression for real-world missing <bNN> marker from Bing response.
   Uses deterministic HTTP/HTML fixtures; does not call Microsoft servers. */
'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const js = fs.readFileSync(path.join(__dirname,'../uxp/chrome/content/bingProvider.js'),'utf8');
const unesc = s => String(s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
                             .replace(/&quot;/g,'"');
class MockHTMLParser {
  parseFromString(html) {
    // Minimal HTML tree including nested wrappers; deliberately NOT a real DOM.
    const all = []; let last=0;
    const tags=/<(b\d+)>([\s\S]*?)<\/\1>/gim; let m;
    while ((m=tags.exec(html))) {
      if (m.index>last) all.push({nodeType:3,textContent:unesc(html.slice(last,m.index))});
      all.push({nodeType:1,nodeName:m[1].toUpperCase(),textContent:unesc(m[2])});
      last=tags.lastIndex;
    }
    if (last<html.length) all.push({nodeType:3,textContent:unesc(html.slice(last))});
    return {body:{childNodes:all,textContent:all.map(n=>n.textContent).join('')}};
  }
}
let requestCount=0, lostCount=0;
class MockXHR {
  constructor(){this.status=200;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(json) {
    const items=JSON.parse(json); requestCount++;
    const responses=items.map(item=>{
      if (item.includes('<b11>')) { // Simulate observed mid-page missing 2nd of 3 segments
        lostCount++;
        return {translations:[{text:item.replace(/<b11>[\s\S]*?<\/b11>/,'')
          .replace(/<(\/?b\d+)>/g,'<$1>')}]};
      }
      if (item.includes('FAIL')) return {translations:[{text:''}]};
      // Microsoft sometimes strips the only tag, but this is unambiguous.
      if (item.includes('Middle')) return {translations:[{text:'CZ:Middle'}]};
      return {translations:[{text: item.replace(/(<b\d+>)/g,'$1CZ:')}]};
    });
    this.responseText=JSON.stringify(responses);
    setImmediate(()=>this.onload());
  }
}
const ctx=vm.createContext({Map,Date,Number,DOMParser:MockHTMLParser,XMLHttpRequest:MockXHR,
  encodeURIComponent,JSON,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
vm.runInContext(js,ctx,{filename:'bingProvider.js'});
const p=ctx.TWPBingProvider;
const call=pieces=>new Promise((ok,no)=>p.translatePieces(pieces,'en','cs',{},'',20000,
  (e,v)=>e?no(e):ok(v)));
(async()=>{
  const group=[{originals:['Hello ','Middle ','World']},{originals:['Other']}];
  let res=await call(group);
  assert.deepStrictEqual(Array.from(res[0]),['CZ:Hello ','CZ:Middle','CZ:World']);
  assert.deepStrictEqual(Array.from(res[1]),['CZ:Other']);
  assert.strictEqual(res.failedSegments,0);
  assert.strictEqual(requestCount,2, 'One fast batch + one targeted split-node retry');
  assert.strictEqual(lostCount,1);
  await call(group);
  assert.strictEqual(requestCount,2,'Recovered group must be cached');
  const dropped=[{originals:['Good ','FAIL','End']}];
  res=await call(dropped);
  assert.strictEqual(res[0][0],'CZ:Good ');
  assert.strictEqual(res[0][1],null,'Unrecoverable segment must not be fabricated');
  assert.strictEqual(res[0][2],'CZ:End');
  assert.strictEqual(res.failedSegments,1,'Failed segments must be reported');
  const prev=requestCount;
  await call(dropped);
  assert(requestCount>prev,'Incomplete group must not be cached');
  // A single-node response without markers must still be usable.
  const singleton=await call([{originals:['Middle']}]);
  assert.strictEqual(singleton[0][0],'CZ:Middle');
  console.log('PASS a9 Bing: missing marker retry, recovered cache, plain singleton, partial-failure preservation');
})().catch(e=>{console.error(e);process.exit(1)});
