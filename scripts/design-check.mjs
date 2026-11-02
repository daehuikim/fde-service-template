import Ajv from 'ajv';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const schema=JSON.parse(readFileSync(new URL('../packages/contracts/design.schema.json',import.meta.url)));
const validate=new Ajv({allErrors:true,strict:true}).compile(schema);
export function checkDesign(pack){
 const errors=[];
 if(!validate(pack))return {status:'fail',errors:(validate.errors??[]).map(e=>`${e.instancePath||'/'} ${e.message}`),scope:'design_artifact_only'};
 const seen=new Set();for(const group of ['sources','requirements','alternatives','assumptions','scenarios','claims'])for(const item of pack[group]){if(seen.has(item.id))errors.push('duplicate_id:'+item.id);seen.add(item.id);}
 const sourceMap=new Map(pack.sources.map(s=>[s.id,s]));const scenarioIds=new Set(pack.scenarios.map(s=>s.id));const alternativeIds=new Set(pack.alternatives.map(s=>s.id));
 const checkRefs=(refs,known,label)=>{for(const ref of refs)if(!known.has(ref))errors.push('unknown_'+label+':'+ref);};
 for(const r of pack.requirements){checkRefs(r.sourceIds,sourceMap,'source');checkRefs(r.scenarioIds,scenarioIds,'scenario');}
 for(const a of pack.alternatives)checkRefs(a.evidenceIds,sourceMap,'source');
 for(const s of pack.scenarios)checkRefs(s.alternativeIds,alternativeIds,'alternative');
 for(const c of pack.claims){checkRefs(c.sourceIds,sourceMap,'source');if(c.kind==='empirical_outcome'&&!c.sourceIds.some(id=>['human_observation','lab_measurement'].includes(sourceMap.get(id)?.kind)))errors.push('unsupported_empirical_claim:'+c.id);}
 for(const s of pack.sources){if(!Number.isFinite(Date.parse(s.checkedAt)))errors.push('invalid_source_date:'+s.id);if(s.kind!=='synthetic'&&!/^https:\/\//.test(s.url))errors.push('missing_public_source_url:'+s.id);}
 const selected=pack.alternatives.filter(a=>a.disposition==='selected');if(!selected.length)errors.push('no_selected_approach');
 if(new Set(pack.alternatives.map(a=>a.mechanism.trim())).size!==pack.alternatives.length)errors.push('duplicate_alternative_mechanism');
 if(Object.values(pack.brief).join('').length>900)errors.push('brief_too_long');
 if(new Set(pack.critiques.map(c=>c.lens)).size<3)errors.push('insufficient_critique_lenses');
 if(pack.stage!=='review_ready')errors.push('draft_not_review_ready');
 // Counts are traceability coverage, not a semantic quality/accuracy score.
 return {status:errors.length?'fail':'pass',scope:'design_artifact_only',errors,metrics:{briefCharacters:Object.values(pack.brief).join('').length,critiqueLenses:pack.critiques.length,requirements:pack.requirements.length,linkedRequirements:pack.requirements.filter(r=>r.scenarioIds.every(id=>scenarioIds.has(id))).length,alternatives:pack.alternatives.length,selected:selected.map(a=>a.id),scenarios:pack.scenarios.length,unresolvedAssumptions:pack.assumptions.length,empiricalOutcomeClaims:pack.claims.filter(c=>c.kind==='empirical_outcome').length},limits:['Source IDs do not prove textual entailment.','No automatic assessment of method suitability, UX quality or customer value.','No product implementation or execution readiness is certified.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const file=process.argv[2];if(!file)throw Error('usage: pnpm design:check designs/<id>/design.json');const raw=readFileSync(file);const result={...checkDesign(JSON.parse(raw)),artifactHash:createHash('sha256').update(raw).digest('hex'),createdAt:new Date().toISOString()};mkdirSync('reports',{recursive:true});writeFileSync('reports/design-'+JSON.parse(raw).id+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(result.status!=='pass')process.exitCode=1;}
