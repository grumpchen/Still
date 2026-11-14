const MAX_TERMS=20;
const MAX_TERM_LENGTH=100;

export function parsePdfHighlightTerms(response:string):string[]{
  const trimmed=response.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let values:unknown;
  try{
    const parsed:unknown=JSON.parse(trimmed);
    values=Array.isArray(parsed)?parsed:parsed&&typeof parsed==='object'&&'terms'in parsed?(parsed as {terms:unknown}).terms:undefined;
  }catch{
    values=trimmed.split(/[\n,;]/).map(line=>line.replace(/^\s*[-*\d.)]+\s*/, '').replace(/^['"“”]+|['"“”]+$/g,'').trim());
  }
  if(!Array.isArray(values))return [];
  const unique=new Map<string,string>();
  for(const raw of values){
    if(typeof raw!=='string')continue;
    const term=raw.trim().replace(/\s+/g,' ');
    if(!term||term.length>MAX_TERM_LENGTH||/[<>\u0000-\u001f]/.test(term))continue;
    const key=term.toLocaleLowerCase();
    if(!unique.has(key))unique.set(key,term);
    if(unique.size>=MAX_TERMS)break;
  }
  return [...unique.values()];
}

export function countPdfHighlightMatches(text:string,terms:readonly string[]):number{
  const source=text.toLocaleLowerCase();
  return terms.reduce((count,term)=>count+(source.includes(term.toLocaleLowerCase())?1:0),0);
}
