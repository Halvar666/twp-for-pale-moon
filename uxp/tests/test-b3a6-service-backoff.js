/* MPL-2.0. b3a6 mocked network failure, bounded retry, and cooldown regression. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const src=path.resolve(__dirname,'../chrome/content');
function harness(filename) {
  let plan=[], sent=[], timers=[], callbackCount=0;
  class XHR {
    constructor(){this.status=0;this.responseText='';this.responseHeaders={};this.headers={};}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(name,value){this.headers[name]=value;}
    getResponseHeader(name){return this.responseHeaders[name]||null;}
    send(body){
      sent.push({method:this.method,url:this.url,body,headers:this.headers});
      const outcome=plan.shift();
      assert.ok(outcome, filename+': unexpected request '+sent.length);
      if (outcome.throwSend) throw Error('send failed');
      if (outcome.network){if(this.onerror)this.onerror();return;}
      if (outcome.timeout){if(this.ontimeout)this.ontimeout();return;}
      if (outcome.abort){if(this.onabort)this.onabort();return;}
      this.status=outcome.status;
      this.responseHeaders=outcome.headers||{};
      this.responseText=typeof outcome.body==='string'?outcome.body:JSON.stringify(outcome.body||{});
      if(this.onload)this.onload();
      if(outcome.duplicate && this.onerror)this.onerror(); // must be ignored
    }
  }
  const ctx=vm.createContext({Map,Array,JSON,String,Number,Date,Error,XMLHttpRequest:XHR,console,
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;}});
  vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var req=new XMLHttpRequest();req.open(method,url,true);return req;}};',ctx);
  vm.runInContext(fs.readFileSync(path.join(src,filename),'utf8'),ctx,{filename});
  return {provider:ctx[filename==='deeplProvider.js'?'TWPDeepLProvider':filename==='googleProvider.js'?'TWPGoogleProvider':'TWPBingProvider'],
    setPlan(items){plan=items.slice();sent.length=0;timers.length=0;callbackCount=0;},
    get sent(){return sent;},get timers(){return timers;},
    takeTimer(){const t=timers.shift();assert.ok(t,'expected retry timer');t.fn();return t.ms;},
    get callbackCount(){return callbackCount;},
    invoke(texts,service){let last=null;this.provider.translateMany(texts,'en','cs',null,service==='google'?'configured-key':'',15000,(error,translated)=>{
      callbackCount++;last={error,translated};
    });return ()=>last;}
  };
}
function deepLSuccess(texts){return {status:200,body:{translations:texts.map(x=>({text:'CS:'+x}))}};}
// DeepL: retry a transient server error once, not more; preserve order and callback uniqueness.
{
  const h=harness('deeplProvider.js');
  h.setPlan([{status:503,body:{}},deepLSuccess(['one','two'])]);
  let r=h.invoke(['one','two']);
  assert.equal(r(),null);
  assert.equal(h.sent.length,1);
  assert.equal(h.timers.length,1);
  assert.equal(h.takeTimer(),1250);
  assert.equal(h.sent.length,2);
  assert.equal(r().error,null);
  assert.deepEqual(JSON.parse(JSON.stringify(r().translated)),['CS:one','CS:two']);
  assert.equal(h.callbackCount,1);
  h.setPlan([{status:503,body:{}},{status:502,body:{}}]);
  r=h.invoke(['three']);h.takeTimer();
  assert.equal(r().error.httpStatus,502);
  assert.equal(r().error.attempts,2);
  assert.equal(h.sent.length,2);
  assert.equal(h.timers.length,0);
  assert.equal(h.callbackCount,1);
  h.setPlan([{network:true},deepLSuccess(['four'])]);
  r=h.invoke(['four']);assert.equal(r(),null);h.takeTimer();assert.equal(r().error,null);
  h.setPlan([{status:403,body:{}}]);
  r=h.invoke(['five']);assert.equal(r().error.httpStatus,403);
  assert.equal(h.sent.length,1);assert.equal(h.timers.length,0);
  h.setPlan([{status:200,body:{unexpected:'shape'}}]);
  r=h.invoke(['invalid']);assert.ok(r().error);assert.equal(h.timers.length,0);
  // HTTP 429 never retries, obeys Retry-After and short-circuits subsequent requests.
  h.setPlan([{status:429,body:{},headers:{'Retry-After':'137'}}]);
  r=h.invoke(['limit']);assert.equal(r().error.httpStatus,429);
  assert.equal(r().error.retryable,false);
  assert.ok(r().error.retryAfterMs>=137000);
  assert.equal(h.timers.length,0);
  r=h.invoke(['different']);assert.equal(r().error.httpStatus,429);
  assert.equal(h.sent.length,1);
}
// Google: Retry-After stops short 429 retries and blocks fresh requests.
{
  const h=harness('googleProvider.js');
  h.setPlan([{status:429,body:{},headers:{'Retry-After':'75'}}]);
  let r=h.invoke(['Hello'],'google');
  assert.equal(r().error.httpStatus,429);
  assert.equal(r().error.retryable,false);
  assert.equal(r().error.rateLimited,true);
  assert.ok(r().error.retryAfterMs>=75000);
  assert.equal(h.timers.length,0);
  r=h.invoke(['Another'],'google');assert.equal(r().error.httpStatus,429);
  assert.equal(h.sent.length,1);
}
// Bing: 429 prevents repeat dispatches; a 503 is flagged transient without automated retry.
{
  const h=harness('bingProvider.js');
  h.setPlan([{status:503,body:{}}]);
  let r=h.invoke(['Hello']);assert.equal(r().error.httpStatus,503);
  assert.equal(r().error.retryable,true);
  assert.equal(h.sent.length,1);assert.equal(h.timers.length,0);
  h.setPlan([{status:429,body:{},headers:{'Retry-After':'80'}}]);
  r=h.invoke(['limit']);assert.equal(r().error.httpStatus,429);
  assert.equal(r().error.retryable,false);
  assert.ok(r().error.retryAfterMs>=80000);
  r=h.invoke(['another']);assert.equal(r().error.httpStatus,429);
  assert.equal(h.sent.length,1);
}
console.log('PASS b3a6: DeepL 1 bounded transient retry, 429 never retried; Google/Bing respect Retry-After and cooldown');
