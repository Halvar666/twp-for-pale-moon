/* MPL-2.0. b3a5: actual custom dictionary tokenizer and translation wrappers. */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ctx={console,setTimeout,clearTimeout};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../chrome/content/customDictionary.js'),'utf8'),ctx);
const dict=ctx.TWPUXPCustomDictionary;
function entries(src){return dict.parse(src);}
assert.strictEqual(dict.normalize('Pale Moon =>\nToolbar => Panel nástrojů\n'),'Pale Moon =>\nToolbar => Panel nástrojů');
assert.strictEqual(dict.decode(dict.encode('Pale Moon =>\nToolbar => Panel nástrojů')),
 'Pale Moon =>\nToolbar => Panel nástrojů','non-ASCII preference roundtrip');
assert(/^[\x00-\x7f]*$/.test(dict.encode('Čeština => český překlad')),'old UXP char pref must be ASCII');
assert.strictEqual(dict.read('v1:not json').length,0,'corrupt preference must fail safely');
assert.throws(()=>entries('bad entry'),/source/);
assert.throws(()=>entries('=> empty'),/Invalid/);
assert.throws(()=>entries('x => y\nx => z'),/Duplicate/);
assert.throws(()=>entries('x'.repeat(121)+' =>'),/Invalid/);
assert.throws(()=>entries(Array(101).fill(0).map((_,i)=>'term'+i+' =>').join('\n')), /at most/);
const words=entries('Moon => LUNA\nPale Moon =>\nToolbar => Panel nástrojů');
let parts=dict.split('The Pale Moon Toolbar works.',words);
assert.deepStrictEqual(JSON.parse(JSON.stringify(parts)),[
 {text:'The ',literal:false},{text:'Pale Moon',literal:true},
 {text:' ',literal:false},{text:'Panel nástrojů',literal:true},
 {text:' works.',literal:false}], 'longest term then explicit replacement');
assert.strictEqual(dict.split('Moonlight',words),null,'never match partial latin words');
assert.strictEqual(dict.split('PALE MOON',words),null,'case-sensitive');
assert(dict.split('日本語文字列',entries('日本語 => japonština')),'CJK without whitespace');
let network=[];
const cache={
 translatePieces(p,service,pieces,from,to,doc,key,timeout,cb){
  network.push(pieces.map(x=>x.originals.join('')));
  cb(null,pieces.map(x=>x.originals.map(s=>s.toUpperCase())));
 },
 translateMany(p,service,strings,from,to,doc,key,timeout,cb){
  network.push(strings.slice()); cb(null,strings.map(s=>s.toUpperCase()));
 }
};
const stub={nodeValue:''};
const pages=[
 {nodes:[stub,stub],originals:['Read Pale Moon', ' Toolbar guide']},
 {nodes:[stub],originals:['Some ordinary text.']}
];
function pieces(cache, input, rules) {
 return new Promise(resolve=>dict.translatePieceBatch(cache,null,'google',input,'en','cs',null,'',20000,rules,(e,v)=>resolve({e,v})));
}
function texts(cache, input, rules) {
 return new Promise(resolve=>dict.translateTextBatch(cache,null,'google',input,'en','cs',null,'',20000,rules,(e,v)=>resolve({e,v})));
}
(async function(){
 let r=await pieces(cache,pages,words);assert.ifError(r.e);
 assert.strictEqual(r.v.length,2);
 assert.deepStrictEqual(Array.from(r.v[0]),['READ Pale Moon',' Panel nástrojů GUIDE']);
 assert.deepStrictEqual(Array.from(r.v[1]),['SOME ORDINARY TEXT.']);
 assert(network.every(batch=>batch.every(s=>!s.includes('Pale Moon')&&!s.includes('Toolbar'))),'protected terms must never reach provider');
 network=[];
 r=await texts(cache,['Pale Moon\nToolbar and friends','normal'],words);
 assert.ifError(r.e);
 assert.strictEqual(r.v[0],'Pale Moon\nPanel nástrojů AND FRIENDS');
 assert.strictEqual(r.v[1],'NORMAL');
 assert(network.every(batch=>batch.every(s=>!s.includes('Pale Moon')&&!s.includes('Toolbar'))),'selected-text terms not transmitted');
 network=[];
 r=await pieces(cache,pages,[]);
 assert.ifError(r.e);assert.strictEqual(r.v.length,2);
 assert(network.length===1 && network[0].length===2,'empty dictionary retains grouped provider protocol');
 const broken={translatePieces(p,s,pieces,a,b,d,k,t,cb){cb(null,[]);}};
 r=await pieces(broken,pages,words);
 assert(r.e,'incomplete response must not silently corrupt DOM');
 let literalRequests=0;
 r=await texts({translateMany(){literalRequests++;}},['Pale Moon'],words);
 assert.ifError(r.e);
 assert.strictEqual(r.v[0],'Pale Moon');assert.strictEqual(literalRequests,0);
 // Exercise the fragment batching limit with many protected terms.
 network=[];
 const long=Array(30).fill('Hello Pale Moon ').join('');
 r=await texts(cache,[long],words);
 assert.ifError(r.e);
 assert(network.length>=2,'expanded fragments must be split into bounded requests');
 assert(network.every(items=>items.length<=8),'no more than eight fragments per request');
 console.log('PASS b3a5 dictionary: Unicode, matching, providers, no-leak, fragment batching');
})().catch(e=>{console.error(e);process.exitCode=1;});
