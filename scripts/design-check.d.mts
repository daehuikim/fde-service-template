export interface DesignCheckResult {status:string; scope:string; errors:string[]; metrics?:{briefCharacters:number;critiqueLenses:number;requirements:number;linkedRequirements:number;alternatives:number;selected:string[];scenarios:number;unresolvedAssumptions:number;empiricalOutcomeClaims:number};limits?:string[]}
export function checkDesign(pack:unknown):DesignCheckResult;
