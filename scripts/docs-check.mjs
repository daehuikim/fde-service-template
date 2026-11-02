import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
const files=['README.md','README.ko.md','docs/en/guide.md','docs/ko/guide.md','docs/en/api.md','docs/ko/api.md','docs/en/releasing.md','docs/ko/releasing.md','docs/en/concepts.md','docs/en/web-example.md','docs/product/reference-review.md'];
let links=0;const errors=[];
for(const file of files){const source=readFileSync(file,'utf8');for(const match of source.matchAll(/\]\(([^)]+)\)|(?:src|href)="([^"]+)"/g)){const target=match[1]??match[2];if(/^(?:https?:|mailto:|#)/.test(target))continue;const clean=decodeURIComponent(target.split('#')[0]);if(!existsSync(path.resolve(path.dirname(file),clean)))errors.push(`${file}: ${target}`);links++;}}
if(errors.length)throw Error('broken documentation links:\n'+errors.join('\n'));
console.log(`pass: ${files.length} bilingual/package documents, ${links} local links`);
