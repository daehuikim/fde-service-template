import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const lock=JSON.parse(readFileSync('config/tools.lock.json'));
let count=0;
for(const skill of lock.skills)for(const [path,expected] of Object.entries(skill.files??{})){if(!existsSync(path)||createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('tool integrity mismatch: '+path);count++;}
for(const blocked of ['share.py','fetch_icons.py','render_png.py'])if(existsSync('.agents/skills/stack-diagram/scripts/'+blocked))throw Error('unreviewed stack tool: '+blocked);
console.log(`pass: ${count} pinned upstream files verified`);
