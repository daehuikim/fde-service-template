import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {Resvg} from '@resvg/resvg-js';

const out = 'docs/assets/';
const product=JSON.parse(readFileSync('docs/architecture/architecture.spec.json')).productArchitecture;
const ids=new Set();for(const component of product.components){if(ids.has(component.id)||!existsSync(component.path))throw Error('invalid product architecture component: '+component.id);ids.add(component.id);}
for(const edge of product.connections)if(!ids.has(edge.from)||!ids.has(edge.to)||!edge.protocol)throw Error('invalid product architecture connection');
const hash = data => createHash('sha256').update(data).digest('hex');
const text = (x, y, label, size = 16, fill = '#102c37', weight = 400, extra = '') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" ${extra}>${label}</text>`;
const rect = (x,y,w,h,fill,stroke='none',radius=12,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const frame = (w,h,title,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${title}</title><style>text{font-family:Arial,Helvetica,sans-serif} .mono{font-family:Menlo,'Courier New',monospace}</style>${body}</svg>`;
const mark = (x,y,size=44) => `<g transform="translate(${x},${y}) scale(${size/44})"><path d="M0 0H44V44H0Z" fill="#8de5ce"/><path d="M12 11H33V17H19V22H29V28H19V35H12Z" fill="#0b222c"/></g>`;
const arrow=(x1,y1,x2,y2,color='#b8c9ce',dash='')=>`<path d="M${x1} ${y1}H${x2}" stroke="${color}" stroke-width="1.5" ${dash}/><path d="M${x2-6} ${y2-4}L${x2} ${y2}L${x2-6} ${y2+4}" stroke="${color}" fill="none" stroke-width="1.5"/>`;
let hero = `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0a1b28"/><stop offset="1" stop-color="#122e36"/></linearGradient><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#a9dbdb" stroke-opacity=".035"/></pattern></defs>`;
hero += rect(0,0,1280,720,'url(#bg)','none',20)+rect(0,0,1280,720,'url(#grid)','none',20);
hero += mark(64,58)+text(124,88,'FDE WORKBENCH',21,'#edf8f7',700,'letter-spacing="2"')+text(64,170,'FROM FIELD PROBLEM TO BUILDABLE DECISION',11,'#8de5ce',700,'letter-spacing="1.7"');
hero += text(60,244,'Think it through.',56,'#f6fafb',700,'letter-spacing="-2"')+text(60,308,'Then build it right.',56,'#8de5ce',700,'letter-spacing="-2"');
hero += text(64,366,'A workbench for evidence, tradeoffs,',20,'#b6cbd2')+text(64,397,'and designs your team can actually use.',20,'#b6cbd2');
hero += rect(64,447,510,144,'#091a26','#29434e',10)+text(84,477,'QUICK START',10,'#6f939f',700,'letter-spacing="1.5"');
hero += text(84,510,'$ fde example support-triage --output demo',12,'#c6e8df',400,'class="mono"')+text(84,537,'$ fde check demo',12,'#c6e8df',400,'class="mono"')+text(84,564,'PASS  ·  reviewable evidence, explicit tradeoffs',11,'#8de5ce',400,'class="mono"');
hero += rect(670,111,546,481,'#132d38','#35525d',16)+rect(690,131,506,441,'#f8fbfb','none',10);
hero += text(718,166,'DECISION RECORD',10,'#627d85',700,'letter-spacing="1.7"')+rect(1060,149,108,24,'#e0f2eb','none',12)+text(1074,165,'REVIEW READY',9,'#117e6a',700);
hero += text(718,210,'Maintenance triage',27,'#102d38',700,'letter-spacing="-.6"')+text(718,240,'Choose the simplest approach the evidence supports.',13,'#66818a');
hero += rect(718,265,450,92,'#eaf2ef','#d3e5df',9)+text(736,290,'SELECTED APPROACH',9,'#5a8177',700,'letter-spacing="1"')+text(736,320,'Rules + owner lookup',20,'#176952',700)+text(736,342,'Keep human approval. Revisit when ambiguity grows.',11,'#54766d');
hero += text(718,392,'01',12,'#288874',700,'class="mono"')+text(751,392,'Compare meaningful alternatives',14,'#244752',600)+text(718,426,'02',12,'#288874',700,'class="mono"')+text(751,426,'Make assumptions and counterarguments explicit',14,'#244752',600)+text(718,460,'03',12,'#288874',700,'class="mono"')+text(751,460,'Deliver a concise brief and a portable report',14,'#244752',600);
hero += `<path d="M718 491H1168" stroke="#dce6e8"/>`+text(718,522,'BRIEF.md',11,'#4d6c78',600,'class="mono"')+text(843,522,'REPORT.html',11,'#4d6c78',600,'class="mono"')+text(992,522,'handoff.zip',11,'#4d6c78',600,'class="mono"');
hero += `<path d="M64 629H1216" stroke="#2c4853"/>`+text(64,668,'PYTHON CLI + SDK',11,'#87a9b4',700,'letter-spacing="1"')+text(369,668,'PORTABLE AGENT SKILL',11,'#87a9b4',700,'letter-spacing="1"')+text(764,668,'ENGLISH / 한국어',11,'#87a9b4',700,'letter-spacing="1"')+text(1093,668,'MIT LICENSE',11,'#87a9b4',700,'letter-spacing="1"');
const heroSvg = frame(1280,720,'FDE Workbench — evidence-led problem design, Python CLI, SDK and portable agent skill',hero);

let architecture=rect(0,0,1280,800,'#f8fbfc','none',18)+text(56,62,'One design record. Three ways to ship.',34,'#102d38',700,'letter-spacing="-1"')+text(56,96,'Your assistant reasons. The Python core checks and packages the result.',17,'#647f89');
architecture += text(56,151,'HOST ASSISTANT',11,'#6d8993',700,'letter-spacing="1.5"')+rect(56,179,244,314,'#102b38','none',14)+mark(80,203,34);
architecture += text(80,277,'Research',23,'#eff8fa',700)+text(80,317,'Compare',23,'#eff8fa',700)+text(80,357,'Critique',23,'#eff8fa',700)+text(80,404,'Uses your chosen models,',13,'#a9c8d1')+text(80,427,'tools and permissions.',13,'#a9c8d1')+text(80,467,'SKILL.md',11,'#8de5ce',600,'class="mono"');
architecture += arrow(304,326,398,326)+text(314,308,'design.json',11,'#5f7b85',400,'class="mono"');
architecture += rect(408,151,450,387,'white','#8cb6b6',14)+text(432,185,'FDE WORKBENCH',12,'#2b7e77',700,'letter-spacing="1.5"')+text(432,217,'Offline Python core',26,'#173c47',700);
for(const [y,title,desc,index] of [[244,'Check','Schema · references · claims · review gates','01'],[335,'Brief','Seven-part summary · English / Korean','02'],[426,'Package','HTML report · manifest · reproducible ZIP','03']]) architecture+=rect(432,y,402,74,'#f2f7f7','none',8)+text(448,y+30,index,11,'#458b82',600,'class="mono"')+text(481,y+30,title,18,'#1d4851',700)+text(481,y+54,desc,11,'#647f89');
architecture += text(943,151,'DELIVERY',11,'#6d8993',700,'letter-spacing="1.5"');
for(const [y,title,desc] of [[179,'Readable reports','Markdown + self-contained HTML'],[292,'Handoff bundles','design + checks + content hashes'],[405,'Installable skills','Explicit destination · versioned assets']]) architecture+=rect(943,y,281,88,'white','#d3e1e5',10)+text(963,y+34,title,18,'#204953',700)+text(963,y+61,desc,12,'#718a92');
architecture += arrow(863,326,935,326);
architecture += rect(56,581,1168,85,'#edf3f4','#d6e2e6',10)+text(80,610,'HOST-MANAGED EXTENSIONS',10,'#577985',700,'letter-spacing="1.5"')+text(80,640,'LLM providers    /    search &amp; RAG    /    SQL &amp; rules    /    solvers    /    ontology when justified',16,'#365e6b');
architecture += `<path d="M178 497V573" stroke="#8ca7af" stroke-width="1.5" stroke-dasharray="5 5"/>`;
architecture += text(56,723,'DISTRIBUTION',10,'#6c8a95',700,'letter-spacing="1.5"')+text(56,755,'uv / pip',16,'#274e5b',700)+text(290,755,'Python API',16,'#274e5b',700)+text(542,755,'Agent skill ZIP',16,'#274e5b',700)+text(868,755,'MIT · local-first · model-agnostic',14,'#6a8590');
const architectureSvg=frame(1280,800,'FDE Workbench architecture — host assistant, offline Python core, reports, bundles and portable skills',architecture);
const assets={'hero.svg':heroSvg,'architecture.svg':architectureSvg};
const inputs=['docs/architecture/architecture.spec.json','scripts/brand-assets.mjs','pyproject.toml','src/fde_workbench/core.py','src/fde_workbench/delivery.py'];
const sourceHash=hash(inputs.map(path=>path+':'+hash(readFileSync(path))).join('\n'));
if(process.argv.includes('--check')){
 const manifest=JSON.parse(readFileSync(out+'manifest.json'));
 if(manifest.sourceHash!==sourceHash)throw Error('brand assets are stale; run pnpm assets');
 for(const [name,expected] of Object.entries(manifest.files))if(hash(readFileSync(out+name))!==expected)throw Error('changed asset: '+name);
 console.log('pass: product figure sources and outputs');
}else{
 for(const [name,svg] of Object.entries(assets)){
  writeFileSync(out+name,svg);
  writeFileSync(out+name.replace('.svg','.png'),new Resvg(svg,{fitTo:{mode:'width',value:1280},font:{loadSystemFonts:true,defaultFontFamily:'Arial'}}).render().asPng());
 }
 const names=['hero.svg','hero.png','architecture.svg','architecture.png'];
 writeFileSync(out+'manifest.json',JSON.stringify({generator:'native SVG + resvg; no browser',sourceHash,files:Object.fromEntries(names.map(name=>[name,hash(readFileSync(out+name))]))},null,2)+'\n');
 console.log('generated: hero + product architecture (SVG / PNG)');
}
