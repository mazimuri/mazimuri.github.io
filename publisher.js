/* CAST / SIGNAL V5.7: pure client-side GitHub Pages export. No network requests. */
(()=>{'use strict';
const enc=new TextEncoder();
const safeName=s=>String(s||'unnamed').toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/-+/g,'-').slice(0,48)||'unnamed';
function base64Bytes(text){const binary=atob(text.replace(/\s/g,''));const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[i]=c>>>0}return t})();
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC_TABLE[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0}
function makeZip(files){const parts=[],central=[];let offset=0,centralSize=0;
for(const f of files){const name=enc.encode(f.name),bytes=f.bytes,crc=crc32(bytes),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);parts.push(h,bytes);
const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);ch.set(name,46);central.push(ch);centralSize+=ch.length;offset+=h.length+bytes.length}
const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
function pack(doc,{charIds=[],worldIds=[]}={}){
if(!doc||doc.version!==5||!Array.isArray(doc.characters))throw Error('V5形式のデータではありません');
const selectedChars=new Set(charIds),selectedWorlds=new Set(worldIds);
if(!selectedChars.size&&!selectedWorlds.size)throw Error('公開するキャラかWORLDを選択してね');
const d=JSON.parse(JSON.stringify(doc)),files=[],images=new Map(),worlds=d.worlds.filter(w=>selectedWorlds.has(w.id)),characters=d.characters.filter(c=>selectedChars.has(c.id)),wid=new Set(worlds.map(w=>w.id)),cid=new Set(characters.map(c=>c.id));
const manifest=[];
function normalizeImage(v,label){if(!v||typeof v!=='string')return v||'';if(!v.startsWith('data:'))return v;if(images.has(v))return images.get(v);
const m=v.match(/^data:image\/(png|jpeg|webp|gif);base64,([\s\S]+)$/i);if(!m)throw Error(label+' の画像形式に対応していません');
const ext={jpeg:'jpg',png:'png',gif:'gif',webp:'webp'}[m[1].toLowerCase()],bytes=base64Bytes(m[2]);const name=`assets/creator-upload-${String(manifest.length+1).padStart(4,'0')}-${safeName(label)}.${ext}`;files.push({name,bytes});manifest.push(name);images.set(v,name);return name}
function normalizeSound(m,label){if(!m?.src||!String(m.src).startsWith('data:'))return;const match=m.src.match(/^data:audio\/mpeg;base64,([\s\S]+)$/i);if(!match)throw Error(label+' の音源形式に対応していません');const bytes=base64Bytes(match[1]);const name='assets/sound-'+safeName(label)+'-'+String(files.length+1)+'.mp3';files.push({name,bytes});m.src=name}
normalizeSound(d.site?.soundtrack,'main-theme');for(const c of characters)normalizeSound(c.soundtrack,c.id);
for(const c of characters){c.worldIds=(c.worldIds||[]).filter(id=>wid.has(id));c.relationships=(c.relationships||[]).filter(x=>cid.has(x.targetId)&&x.targetId!==c.id);c.artwork=normalizeImage(c.artwork,`${c.id}-artwork`);c.icon=normalizeImage(c.icon,`${c.id}-icon`);for(let i=0;i<(c.gallery||[]).length;i++){const g=c.gallery[i];g.image=normalizeImage(g.image,`${c.id}-gallery-${i+1}`)}if(c.createdAt&&!c.firstPublishedAt)c.firstPublishedAt=c.createdAt}
for(const w of worlds){w.image=normalizeImage(w.image,`${w.id}-world`);if(w.createdAt&&!w.firstPublishedAt)w.firstPublishedAt=w.createdAt}
function addJson(name,value){files.push({name:`content/${name}.json`,bytes:enc.encode(JSON.stringify(value,null,2)+'\n')})}
addJson('characters',characters);addJson('worlds',worlds);addJson('tags',d.tags);addJson('site',d.site);
const size=files.reduce((t,f)=>t+f.bytes.length,0);if(size>300*1024*1024)throw Error('公開用ZIPが300MBを超えています');
return {blob:makeZip(files),files,exportDoc:{version:5,characters,worlds,tags:d.tags,site:d.site},characters:characters.length,worlds:worlds.length,images:manifest.length,size};
}
window.CAST_PUBLISH={pack};
})();
