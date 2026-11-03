/* 1.0.0b2a1: selected text from a file / Japanese GitHub content. */
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const base=path.resolve(__dirname,'../uxp/chrome/content');
let original='\r\n\r\n  v2.5\r\n・[update] brotli を更新します\r\n\r\n・[fix] 日本語の更新履歴   \r\n';
const doc={location:{protocol:'file:'},body:{},documentElement:{getAttribute(k){return k==='lang'?'en':null}},
 querySelectorAll(){return []},defaultView:{getSelection(){return original}}};
const dialogs=[], calls=[], prefs=new Map([
 ['extensions.twpuxp.from','auto'],['extensions.twpuxp.to','en'],
 ['extensions.twpuxp.translationService','google']]);
const service={getCharPref(k){if(!prefs.has(k))throw Error(k);return prefs.get(k);},
 getBoolPref(){throw Error('missing pref')},getIntPref(){throw Error('missing pref')},setCharPref(k,v){prefs.set(k,v)}};
const provider={translateMany(texts,src,tgt,d,key,timeout,cb){
 calls.push({src,tgt,texts});cb(null,texts.map(x=>'T'+x));
}};
const ctx=vm.createContext({console,WeakMap,Set,Map,Date,Array,Math,Error,setTimeout,clearTimeout,
 Components:{classes:{'@mozilla.org/preferences-service;1':{getService(){return service}}},interfaces:{nsIPrefBranch:{}}},
 gBrowser:{selectedBrowser:{contentDocument:doc}},
 TWPUXPCache:{translateMany(p,s,t,from,to,d,key,timeout,cb){p.translateMany(t,from,to,d,key,timeout,cb);},close(){}},
 TWPUXPProviders:{has(n){return n==='google'},get(){return provider}},
 document:{getElementById(){return null}},
 window:{addEventListener(){},removeEventListener(){},alert(m){throw Error(m)},openDialog(...args){dialogs.push(args)}}});
for(const file of ['textLayout.js','languageDetector.js','pageController.js','selectionController.js','browserChrome.js','browser.js'])
 vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
ctx.TWPUXP.translateSelectedText();
assert.strictEqual(dialogs.length,1);
const args=dialogs[0][3];
assert.strictEqual(args.original,original,'selection must not strip outer newlines');
assert.strictEqual(args.source,'auto','Japanese text overrides GitHub language metadata');
let translated;
args.request((err,output)=>{if(err)throw err;translated=output;});
assert.strictEqual(translated,'\r\n\r\n  Tv2.5\r\nT・[update] brotli を更新します\r\n\r\nT・[fix] 日本語の更新履歴   \r\n');
assert(calls.every(c=>c.src==='auto'&&c.tgt==='en'&&c.texts.every(t=>!/[\r\n]/.test(t))));
assert.strictEqual(prefs.get('extensions.twpuxp.from'),'auto');
let explicit;args.request('ja','en','google',(err,output)=>{if(err)throw err;explicit=output;});
assert.strictEqual(explicit,translated);
assert.strictEqual(calls[calls.length-1].src,'ja','explicit language must override detection');
console.log('PASS b2a1 selected text: file://, Japanese auto source, outer CRLF, blanks, explicit language');
