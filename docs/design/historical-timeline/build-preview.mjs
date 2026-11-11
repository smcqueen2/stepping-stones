import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const template=await readFile(new URL('timeline-template.html',root),'utf8');
const content=JSON.parse(await readFile(new URL('timeline-content.json',root),'utf8'));
const keys=[...new Set(content.milestones.map(m=>m.image))];
async function previewArt(key) {
  try { return await readFile(new URL(`assets/previews/${key}.webp`,root)); }
  catch(error) {
    if(error.code!=='ENOENT') throw error;
    return readFile(new URL(`assets/${key}.webp`,root));
  }
}
const art=Object.fromEntries(await Promise.all(keys.map(async key=>[key,'data:image/webp;base64,'+(await previewArt(key)).toString('base64')])));
const json=value=>JSON.stringify(value).replaceAll('<','\u003c');
const html=template.replace('TIMELINE_CONTENT_JSON',json(content)).replace('TIMELINE_ART_JSON',json(art));
if(Buffer.byteLength(html)>1000000) throw new Error('Preview exceeds inline size limit.');
if(!process.argv.includes('--check')) await writeFile(new URL('ogmore-history-timeline-concepts.html',root),html);
console.log(`${process.argv.includes('--check')?'Validated':'Built'} ${Buffer.byteLength(html)} bytes, ${content.milestones.length} milestones, ${keys.length} paintings.`);
