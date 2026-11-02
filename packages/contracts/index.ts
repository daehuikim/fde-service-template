import Ajv from "ajv";
import schema from "./request.schema.json";
import type { RequestRow } from "./request.generated";
export type { RequestRow } from "./request.generated";
export interface Issue { row: number; field: string; code: string; message: string }
export interface ValidationResult { version: "1"; mode: "fixture" | "live"; sourceHash: string; total: number; accepted: number; rows: unknown[]; issues: Issue[]; evidence: { tool: string; version: string; durationMs: number }[] }
export const validateRow = new Ajv({allErrors:true,strict:true,coerceTypes:false,useDefaults:false,removeAdditional:false}).compile<RequestRow>(schema);

import resultSchema from "./result.schema.json";
const validateOutput=new Ajv({allErrors:true,strict:true}).compile<ValidationResult>(resultSchema);
export function assertResult(r:unknown): asserts r is ValidationResult {if(!validateOutput(r))throw new Error("invalid_tool_output");const v=r;if(v.total!==v.rows.length||v.accepted>v.total||v.accepted!==v.total-new Set(v.issues.map(i=>i.row)).size||v.issues.some(i=>i.row>v.total+1))throw new Error("invalid_tool_output");}
