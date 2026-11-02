/* MPL-2.0. Deterministic retries for temporary Google endpoint failures. */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const js=fs.readFileSync(path.join(__dirname,'..','uxp','chrome','content','googleProvider.js'),'utf8');
let plan=[], calls=0, waits=[];
class MockXHR {
  constructor(){this.status=200;}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(){}
  send(body){
    assert.strictEqual(this.method,'POST','configured key should bypass auth script');
    calls++;
    const response=plan.shift();
    assert(response!==undefined, 'unexpected extra retry');
    if(response===0){this.status=0;return setImmediate(()=>this.onerror());}
    this.status=response;
    if(response===200){
      const items=JSON.parse(body)[0][0];
      this.responseText=JSON.stringify([items.map(()=>'<pre>Přeloženo</pre>'),[]]);
    }
    setImmediate(()=>this.onload());
  }
}
const doc={createElement(tag){assert.strictEqual(tag,'textarea');let result={value:''};
  Object.defineProperty(result,'innerHTML',{set(text){this.value=text;}});return result;}};
const quickTimeout=(cb,ms)=>{waits.push(ms);return setTimeout(cb,0);};
const ctx=vm.createContext({XMLHttpRequest:MockXHR,Map,Date,setTimeout:quickTimeout,console});
// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
vm.runInContext(js,ctx);
let nextId=1;
function request(statuses){
  plan=statuses.slice();calls=0;waits=[];
  const id=String(nextId++);
  const group=[{originals:['Message '+id],nodes:[{}]}];
  return new Promise(resolve=>ctx.TWPGoogleProvider.translatePieces(group,'en','cs',doc,'test-key',20000,
    (error,result)=>resolve({error,result,calls,waits:waits.slice()})));
}
(async()=>{
  let r=await request([502,200]);
  assert(!r.error);assert.strictEqual(r.calls,2);assert.deepStrictEqual(r.waits,[650]);
  assert.strictEqual(r.result[0][0],'Přeloženo');
  r=await request([429,503,200]);
  assert(!r.error);assert.strictEqual(r.calls,3);assert.deepStrictEqual(r.waits,[650,1600]);
  r=await request([502,502,502]);
  assert(r.error);assert.strictEqual(r.error.httpStatus,502);assert.strictEqual(r.error.retryable,true);
  assert.strictEqual(r.error.attempts,3);assert.strictEqual(r.calls,3);
  r=await request([400]);
  assert(r.error);assert.strictEqual(r.error.httpStatus,400);assert(!r.error.retryable);
  assert.strictEqual(r.calls,1);assert.strictEqual(r.waits.length,0);
  r=await request([0,200]);
  assert(!r.error);assert.strictEqual(r.calls,2);
  console.log('PASS a12: transient 502/429/503/network errors retried, permanent 400 not retried, bounded retries');
})().catch(e=>{console.error(e);process.exit(1)});
