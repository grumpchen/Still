/** Resolve a pending file save without treating an intentional empty edit as missing. */
export function pendingNoteText(pending:ReadonlyMap<string,string>,path:string,fallback:string):string{
 return pending.has(path)?pending.get(path)!:fallback;
}
