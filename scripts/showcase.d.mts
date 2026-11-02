export interface ShowcaseEntry {id:string;title:string;title_ko?:string;summary:string;summary_ko?:string;url:string;source?:string;authors:string[];date:string;domain:string;evidence:'production'|'pilot'|'desk-review'|'synthetic';skills:string[];language:'en'|'ko'|'en+ko';featured?:boolean}
export function validate(file:string,raw:string):{entry?:ShowcaseEntry;errors:string[]};
export function load():{entries:ShowcaseEntry[];errors:string[]};
export function rank(entries:ShowcaseEntry[]):ShowcaseEntry[];
export function renderPage(entries:ShowcaseEntry[]):string;
export function renderReadmeBlock(entries:ShowcaseEntry[],lang:'en'|'ko'):string;
