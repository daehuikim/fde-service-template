import {it,expect} from 'vitest';
import {load,rank,validate,renderReadmeBlock,type ShowcaseEntry} from '../scripts/showcase.mjs';
const base:ShowcaseEntry={id:'demo-case',title:'Demo',summary:'A demo case.',url:'https://example.com/demo',authors:['octocat'],date:'2026-01-15',domain:'other',evidence:'synthetic',skills:['fde-workbench'],language:'en'};
it('accepts every committed showcase entry',()=>{const r=load();expect(r.errors).toEqual([]);expect(r.entries.length).toBeGreaterThan(0);});
it('accepts a minimal valid entry',()=>{expect(validate('demo-case.json',JSON.stringify(base)).errors).toEqual([]);});
it('rejects mismatched file names, unknown skills, http links and table-breaking text',()=>{
  const errors=validate('other.json',JSON.stringify({...base,skills:['missing-skill'],url:'http://example.com',summary:'a | b',featured:'yes'})).errors.join('\n');
  for(const part of ['file name','unknown skill','https URL','"summary"','"featured"'])expect(errors).toContain(part);
});
it('ranks maintainer picks, then evidence, then newest',()=>{
  const e=(id:string,extra:Partial<ShowcaseEntry>)=>({...base,id,...extra});
  const order=rank([e('old-pilot',{evidence:'pilot',date:'2025-01-01'}),e('new-synthetic',{date:'2026-06-01'}),e('new-pilot',{evidence:'pilot',date:'2026-02-01'}),e('pick',{featured:true})]).map(x=>x.id);
  expect(order).toEqual(['pick','new-pilot','old-pilot','new-synthetic']);
});
it('limits the README block and links the full page',()=>{
  const many=Array.from({length:7},(_,i)=>({...base,id:`c${i}`}));
  const block=renderReadmeBlock(many,'en');
  expect(block.split('\n').filter(l=>l.startsWith('| [')).length).toBe(5);
  expect(block).toContain('[See all 7](SHOWCASE.md)');
});
