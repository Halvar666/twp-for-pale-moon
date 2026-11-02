/* MPL-2.0 – a26: tests real call paths and fail-closed privacy decisions, mocked network. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const load=n=>fs.readFileSync(path.join(root,'chrome/content',n),'utf8');
const xul=load('browserOverlay.xul');
const helperPos=xul.indexOf('chrome://twpuxp/content/privacyXHR.js');
assert(helperPos>0 && helperPos<xul.indexOf('chrome://twpuxp/content/googleProvider.js'));
for(const id of ['googleProvider.js','bingProvider.js','deeplProvider.js'])
  assert.match(load(id),/TWPUXPPrivacyXHR\.create\(/);
const options=load('options.xul'), optionsJS=load('options.js');
const defaults=fs.readFileSync(path.join(root,'defaults/preferences/defaults.js'),'utf8');
assert.match(defaults,/privacyEnhancedRequests", true/);
assert.match(options,/id="twpuxp-option-privacy"/);
assert.match(optionsJS,/getBool\("privacyEnhancedRequests", true\)/);
assert.match(optionsJS,/setBoolPref\(PREFIX \+ "privacyEnhancedRequests"/);

function environment({privacy=true, channel=true, referrer=null, refClearable=true, flagAccepted=true, optionsSupported=true}={}) {
  const flag=1<<14;
  let pref=privacy;
  const made=[], sent=[], opts=[];
  class FakeXHR {
    constructor(options) {
      if(options && !optionsSupported) throw new Error('constructor flags unsupported');
      this.constructOptions=options;
      this.headers={};
      this.timeout=0;
      this._credentials=true;
      this.status=200;
      if(channel) {
        let flags=0;
        const http={referrer};
        if(!refClearable) {
          Object.defineProperty(http,'referrer',{get(){return referrer;},set(){/* refused */}});
        }
        this.channel={
          get loadFlags(){return flags;},
          set loadFlags(v){if(flagAccepted)flags=v;},
          QueryInterface(){return http;},
          http
        };
      }
      made.push(this);
    }
    open(m,u,a){this.method=m;this.url=u;this.async=a;}
    setRequestHeader(k,v){this.headers[k]=v;}
    set withCredentials(v){this._credentials=v;}
    get withCredentials(){return this._credentials;}
    send(body) {
      assert(this.url.startsWith('https://'));
      if(pref) {
        assert(this.channel && (this.channel.loadFlags & flag),'all sent protected');
        assert.equal(this.channel.http.referrer,null,'no referrer');
      }
      this.body=body;sent.push(this);
      if(/translate_http/.test(this.url)) this.responseText='{"x-goog-api-key":"'+ 'a'.repeat(39)+'"}';
      else if(/translateHtml/.test(this.url)) this.responseText=JSON.stringify([["<pre>Ahoj</pre>"]]);
      else if(/edge.microsoft/.test(this.url)) this.responseText=JSON.stringify([{translations:[{text:'<b10>Ahoj</b10>'}]}]);
      else if(/deepl/.test(this.url)) this.responseText=JSON.stringify({translations:[{text:'Ahoj'}]});
      if(this.onload)this.onload();
    }
  }
  const prefBranch={getBoolPref(n){assert.equal(n,'extensions.twpuxp.privacyEnhancedRequests');return pref;}};
  const ctx=vm.createContext({XMLHttpRequest:FakeXHR,
    Components:{interfaces:{nsIPrefBranch:{},nsIRequest:{LOAD_ANONYMOUS:flag},nsIHttpChannel:{}},
      classes:{'@mozilla.org/preferences-service;1':{getService(){return prefBranch;}}}},
    setTimeout,Date,Map,console,DOMParser:class {parseFromString(x){return {body:{childNodes:[],textContent:x}}}}});
  vm.runInContext(load('privacyXHR.js'),ctx,{filename:'privacyXHR.js'});
  return {ctx,made,sent,opts,setPrivacy(v){pref=v;},flag};
}
const basic=environment();
const x=basic.ctx.TWPUXPPrivacyXHR.create('GET','https://translate.googleapis.com/test');
assert.equal(x.withCredentials,false);
assert.equal(x.channel.loadFlags & basic.flag,basic.flag);
assert.equal(x.channel.http.referrer,null);
assert.equal(x.constructOptions.mozAnon,true);
assert.throws(()=>basic.ctx.TWPUXPPrivacyXHR.create('POST','http://edge.microsoft.com/translate'),/HTTPS/);
assert.throws(()=>basic.ctx.TWPUXPPrivacyXHR.create('GET','javascript:alert(1)'),/HTTPS/);
assert.equal(basic.sent.length,0);

// Constructor options are not necessarily supported by Pale Moon chrome XHR.
const noMozAnon=environment({optionsSupported:false});
const y=noMozAnon.ctx.TWPUXPPrivacyXHR.create('POST','https://edge.microsoft.com/translate');
assert(y.channel.loadFlags&noMozAnon.flag,'LOAD_ANONYMOUS still required even when mozAnon unavailable');
assert.equal(noMozAnon.made.length,1,'failed constructor attempt does not leave an open connection');

// A present HTTP referrer is cleared or the request is refused.
const withRef=environment({referrer:{spec:'https://example.com/private?q=1'}});
assert.equal(withRef.ctx.TWPUXPPrivacyXHR.create('GET','https://translate.googleapis.com/').channel.http.referrer,null);
const refLocked=environment({referrer:{spec:'https://example.com/'},refClearable:false});
assert.throws(()=>refLocked.ctx.TWPUXPPrivacyXHR.create('GET','https://translate.googleapis.com/'),/cannot verify an empty HTTP referrer/);
assert.equal(refLocked.sent.length,0);
for(const settings of [{channel:false},{flagAccepted:false}]) {
  const env=environment(settings);
  assert.throws(()=>env.ctx.TWPUXPPrivacyXHR.create('POST','https://edge.microsoft.com/translate'),/LOAD_ANONYMOUS/);
  assert.equal(env.sent.length,0);
}
const off=environment({privacy:false,channel:false});
const z=off.ctx.TWPUXPPrivacyXHR.create('POST','https://edge.microsoft.com/translate');
assert.equal(z.constructOptions,undefined);
assert.equal(z.channel,undefined);

// Dynamic preference changes apply to the next request in the existing window.
const flip=environment();
flip.setPrivacy(false);
assert.equal(flip.ctx.TWPUXPPrivacyXHR.enabled(),false);
const standard=flip.ctx.TWPUXPPrivacyXHR.create('POST','https://edge.microsoft.com/translate');
assert.equal(standard.constructOptions,undefined);
flip.setPrivacy(true);
assert.equal(flip.ctx.TWPUXPPrivacyXHR.enabled(),true);

// All 4 network paths – Google JS token and POST, Bing POST, DeepL POST.
const api=environment();
for (const module of ['googleProvider.js','bingProvider.js','deeplProvider.js'])
  vm.runInContext(load(module),api.ctx,{filename:module});
let googleErr;
const doc={createElement(){return {set innerHTML(v){this.value=v},value:''}}};
api.ctx.TWPGoogleProvider.translateMany(['Hello'],'auto','cs',doc,'',20000,(err,res)=>{googleErr=err;assert.equal(res[0],'Ahoj')});
assert.equal(googleErr,null);
let bingResult;
api.ctx.TWPBingProvider.translateMany(['Hello'],'auto','cs',doc,'',20000,(err,res)=>{bingResult=err||res});
assert(bingResult,'Bing callback invoked');
let deeplResult;
api.ctx.TWPDeepLProvider.translateMany(['Hello'],'auto','cs',doc,'',20000,(err,res)=>{deeplResult=err||res});
assert.equal(deeplResult[0],'Ahoj');
assert.equal(api.sent.length,4,'Google token + translation, Bing, DeepL');
const hosts=api.sent.map(r=>new URL(r.url).hostname);
assert.deepEqual(hosts,[
  'translate.googleapis.com','translate-pa.googleapis.com','edge.microsoft.com','oneshot-free.www.deepl.com']);
assert(api.sent.every(r=>r.channel.loadFlags&api.flag));
assert(api.sent.every(r=>r.withCredentials===false));
const deep=api.sent[3];
assert.equal(deep.headers['Authorization'],'None','static DeepL protocol header retained');

// In fail-closed mode provider catches error and callback receives it; none sent.
const fail=environment({channel:false});
for (const mod of ['googleProvider.js','bingProvider.js','deeplProvider.js'])
  vm.runInContext(load(mod),fail.ctx,{filename:mod});
let errors=[];
fail.ctx.TWPGoogleProvider.translateMany(['x'],'auto','cs',doc,'',20000,e=>errors.push(e));
fail.ctx.TWPBingProvider.translateMany(['x'],'auto','cs',doc,'',20000,e=>errors.push(e));
fail.ctx.TWPDeepLProvider.translateMany(['x'],'auto','cs',doc,'',20000,e=>errors.push(e));
assert.equal(errors.length,3);
assert(errors.every(e=>e.privacyProtectionFailed && e.retryable===false));
assert.equal(fail.sent.length,0);
console.log('PASS a26: anonymous channels, referrer, no silent fallback, 4 provider request paths, settings');
