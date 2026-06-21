export const TABLE_TAGS = ["table","thead","tbody","tfoot","tr","th","td","caption","colgroup","col","br","span","strong","em","sup","sub"];
export const TABLE_ATTRS = ["rowspan","colspan","scope"];

export interface HtmlSanitizer { sanitize:(html:string,config:{ALLOWED_TAGS:string[];ALLOWED_ATTR:string[]})=>string }
export function sanitizeTableHtml(sanitizer:HtmlSanitizer,html:string){return sanitizer.sanitize(html,{ALLOWED_TAGS:TABLE_TAGS,ALLOWED_ATTR:TABLE_ATTRS})}
