import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile(new URL('./data-page-template.html', import.meta.url), 'utf8');
const snapshot = JSON.parse(await readFile(new URL('./history-study.json', import.meta.url), 'utf8'));
const html = template.replace('HISTORY_STUDY_JSON', JSON.stringify(snapshot).replaceAll('<', '\u003c'));
await writeFile(new URL('./ogmore-data-page-concepts.html', import.meta.url), html);
console.log(`Wrote ${Buffer.byteLength(html)} bytes; snapshot ${snapshot.fetchedAt}`);
