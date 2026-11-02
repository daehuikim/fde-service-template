import {describe,it,expect,vi} from "vitest";
import cases from "../evalsets/cases.json";
import {validateCsv,authorize} from "../packages/tools";
import {transition} from "../packages/domain";
import {validateRow,assertResult} from "../packages/contracts";
import {POST as validate} from "../apps/web/app/api/validate/route";
import {POST as save} from "../apps/web/app/api/runs/route";
const sample="request_id,title,department,amount\nR,요청,operations,1";
describe("synthetic expectations",()=>{for(const c of cases)it(c.id,()=>{if(c.error)expect(()=>validateCsv(c.csv)).toThrow();else expect(validateCsv(c.csv).accepted).toBe(c.accepted);});});
it("rejects extra properties and forged types",()=>{expect(validateRow({request_id:"R",title:"a",department:"support",amount:"1"})).toBe(false);expect(validateRow({request_id:"R",title:"a",department:"support",amount:1,evidence:"fake"})).toBe(false);});
it("enforces cancellation and bounded input",()=>{expect(()=>validateCsv(sample,AbortSignal.abort())).toThrow();expect(()=>validateCsv("a".repeat(200001))).toThrow("input_too_large");});
it("rejects duplicate headers",()=>{expect(()=>validateCsv("title,title,department,amount\na,b,support,1")).toThrow("duplicate_header");});
it("rejects illegal state transitions",()=>{expect(transition("draft","validating")).toBe("validating");expect(()=>transition("cancelled","saved")).toThrow();expect(()=>transition("saved","validating")).toThrow();});
it("validates tenant context",()=>{expect(()=>authorize({tenant:"../victim",subject:"s"})).toThrow();expect(()=>authorize({tenant:"a",subject:""})).toThrow();});
function request(body:unknown,headers:Record<string,string>={}){return new Request("http://localhost/api/validate",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});}
it("API validates real parser output and rejects extra envelope",async()=>{expect((await validate(request({csv:sample}))).status).toBe(200);expect((await validate(request({csv:sample,tenant:"victim"}))).status).toBe(400);expect((await validate(request({csv:1}))).status).toBe(400);});
it("fixture cannot pretend to persist",async()=>{expect((await save(request({csv:sample,key:"test-key-123"}))).status).toBe(409);});
it("production and live fail closed",async()=>{const env=process.env.NODE_ENV,mode=process.env.APP_MODE;try{vi.stubEnv("NODE_ENV","production");expect((await validate(request({csv:sample}))).status).toBe(400);process.env.APP_MODE="live";expect((await validate(request({csv:sample}))).status).toBe(401);}finally{vi.stubEnv("NODE_ENV",env);if(mode===undefined)delete process.env.APP_MODE;else process.env.APP_MODE=mode;}});

it("rejects fabricated or inconsistent tool output",()=>{const r=validateCsv(sample);expect(()=>assertResult({...r,accepted:3})).toThrow("invalid_tool_output");expect(()=>assertResult({...r,evidence:[{tool:"fake"}]})).toThrow("invalid_tool_output");});

it("rejects prototype column names",()=>{expect(()=>validateCsv("__proto__,title,department,amount\nX,요청,support,1")).toThrow("invalid_headers");});
