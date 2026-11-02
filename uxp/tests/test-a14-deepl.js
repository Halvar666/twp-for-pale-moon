/* MPL-2.0. Unit tests for the experimental upstream TWP DeepL storefront port.
 * These tests use a simulated HTTP transport and do not imply live service availability.
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('node:assert/strict');
const basedir=path.resolve(__dirname, '../chrome/content');
const requests=[];
let responder = () => {throw new Error('No responder installed');};
class FakeXHR {
  constructor() {this.status=0;this.responseText='';this.headers={};this.timeout=0;}
  getResponseHeader(name) {return this.responseHeaders && this.responseHeaders[name] || null;}
  open(method,url) {this.method=method;this.url=url;}
  setRequestHeader(key,value) {this.headers[key]=value;}
  send(body) {
    this.sent=JSON.parse(body);requests.push(this);
    const response=responder(this);
    if (response.error) {this.onerror();return;}
    this.status=response.status;this.responseHeaders=response.headers || {};
    this.responseText=typeof response.body ==='string'?response.body:JSON.stringify(response.body);
    this.onload();
  }
}
const ctx={Map, Error, Array, String, JSON, Number, Date, XMLHttpRequest:FakeXHR};
vm.createContext(ctx);
function load(name) {// Provider protocol fixture: isolate translation responses from a26 privacy
// channel behavior (separately tested in test-a26-privacy.js).
vm.runInContext('var TWPUXPPrivacyXHR = {create:function(method,url){var r=new XMLHttpRequest();r.open(method,url,true);return r;}};',ctx);
vm.runInContext(fs.readFileSync(path.join(basedir,name),'utf8'),ctx,{filename:name});}
load('deeplProvider.js');
let result = null;
const done=(err,value)=>{result={err,value};};
// Flatten text-node groups and reconstruct exactly, in original order.
responder=x=>({status:200,body:{translations:x.sent.text.map(t=>({text:'CS:'+t}))}});
ctx.TWPDeepLProvider.translatePieces([
  {originals:['Hello ','world','!']}, {originals:['Next paragraph']}
], 'en','cs',null,'',15000,done);
assert.equal(result.err,null);
assert.equal(JSON.stringify(result.value),JSON.stringify([['CS:Hello ','CS:world','CS:!'],['CS:Next paragraph']]));
assert.equal(requests.length,1);
assert.equal(requests[0].method,'POST');
assert.equal(requests[0].url,'https://oneshot-free.www.deepl.com/v1/translate');
assert.equal(requests[0].headers['Content-Type'],'application/json');
assert.equal(requests[0].headers['Authorization'],'None');
assert.equal(requests[0].sent.source_lang,'en');
assert.equal(requests[0].sent.target_lang,'cs');
assert.equal(requests[0].sent.language_model,undefined);
assert.equal(requests[0].sent.usage_type,undefined);
// Same pieces hit cache; no extra request.
result=null;
ctx.TWPDeepLProvider.translatePieces([{originals:['Hello ','world','!']},{originals:['Next paragraph']}], 'en','cs',null,'',15000,done);
assert.equal(result.err,null); assert.equal(requests.length,1);
// Partial cache miss still inserts correct result in original index.
ctx.TWPDeepLProvider.translatePieces([{originals:['New']},{originals:['Next paragraph']}], 'en','cs',null,'',15000,done);
assert.equal(requests.length,2);
assert.equal(JSON.stringify(result.value),JSON.stringify([['CS:New'],['CS:Next paragraph']]));
assert.equal(JSON.stringify(requests[1].sent.text),JSON.stringify(['New']));
// Default en target and zh variants.
ctx.TWPDeepLProvider.translateMany(['A','B'],'auto','en',null,'',12000,done);
assert.equal(requests[2].sent.source_lang,undefined);
assert.equal(requests[2].sent.target_lang,'en-US');
assert.equal(JSON.stringify(result.value),JSON.stringify(['CS:A','CS:B']));
assert.equal(ctx.TWPDeepLProvider.normalizeLanguage('zh-CN',true),'zh-Hans');
assert.equal(ctx.TWPDeepLProvider.normalizeLanguage('es-MX',true),'es-419');
// Reject missing, malformed, or reordered count instead of guessing segments.
responder=x=>({status:200,body:{translations:[{text:'missing'}]}});
ctx.TWPDeepLProvider.translateMany(['bad-one','bad-two'],'en','de',null,'',12000,done);
assert.match(result.err.message,/count/);
assert.equal(result.value,null);
// Don't cache malformed result. Retry with a proper response.
responder=x=>({status:200,body:{translations:x.sent.text.map(t=>({text:'OK:'+t}))}});
ctx.TWPDeepLProvider.translateMany(['bad-one','bad-two'],'en','de',null,'',12000,done);
assert.equal(result.err,null);
assert.equal(JSON.stringify(result.value),JSON.stringify(['OK:bad-one','OK:bad-two']));
// HTTP 429 cooldown is tested at the very end of this fixture.
responder=()=>({status:403,body:{message:'denied'}});
ctx.TWPDeepLProvider.translateMany(['forbidden'],'en','fr',null,'',12000,done);
assert.equal(result.err.httpStatus,403); assert.equal(result.err.retryable,false);
// Mixed known and new selection fragments, copy still remains ordered.
responder=x=>({status:200,body:{translations:x.sent.text.map(t=>({text:'FR:'+t}))}});
ctx.TWPDeepLProvider.translateMany(['one','two','three'],'en','fr',null,'',12000,done);
assert.equal(JSON.stringify(result.value),JSON.stringify(['FR:one','FR:two','FR:three']));
// Catalog comes from upstream list, must include Czech and common pairs.
load('languageCatalog.js');
let supported=ctx.TWPUXPLanguageCatalog.supported;
assert.ok(supported.deepl.length>90);
assert.ok(supported.deepl.includes('cs'));
assert.ok(supported.deepl.includes('en'));
assert.equal(new Set(supported.deepl).size,supported.deepl.length);
assert.equal(supported.google.length,250);
assert.equal(supported.bing.length,138);
// Registry: providers expose both batch methods and preserve Google default.
ctx.TWPGoogleProvider={translatePieces(){},translateMany(){}};
ctx.TWPBingProvider={translatePieces(){},translateMany(){}};
load('translationProviders.js');
assert.equal(ctx.TWPUXPProviders.get('missing'),ctx.TWPGoogleProvider);
assert.equal(ctx.TWPUXPProviders.get('deepl'),ctx.TWPDeepLProvider);
assert.equal(ctx.TWPUXPProviders.names().length,3);
// A failed /v1/translate HTTP 404 is not retried or silently forwarded to Google.
responder=()=>({status:404,body:{message:'not found'}});
ctx.TWPDeepLProvider.translateMany(['not-available'],'en','it',null,'',12000,done);
assert.equal(result.err.httpStatus,404);
assert.equal(result.err.retryable,false);
assert.match(result.err.message,/choose Google or Bing/);
// A 429 must stop new network requests, not trigger an aggressive retry.
responder=()=>({status:429,body:{message:'too many requests'},headers:{'Retry-After':'120'}});
const beforeLimit = requests.length;
ctx.TWPDeepLProvider.translateMany(['rate-limited'],'en','fr',null,'',12000,done);
assert.equal(result.err.httpStatus,429);
assert.equal(result.err.rateLimited,true);
assert.equal(result.err.retryable,false);
assert.ok(result.err.retryAfterMs>=120000);
assert.equal(requests.length,beforeLimit+1);
ctx.TWPDeepLProvider.translateMany(['rate-limited-again'],'en','fr',null,'',12000,done);
assert.equal(result.err.httpStatus,429);
assert.equal(requests.length,beforeLimit+1, 'cooldown must prevent fresh requests');
console.log('a16 DeepL provider: translation, cache, mapping, HTTP 404, 429 cooldown and Retry-After passed.');
