export const PDF_HIGHLIGHT_KEYWORD_LIMIT=20;
export const PDF_HIGHLIGHT_TERM_LENGTH_LIMIT=100;

export interface PdfHighlightRange {spanIndex:number;start:number;end:number;keyword:string}

function normalizedWithOffsets(value:string):{text:string;offsets:number[]}{
 let text='',previousSpace=false;const offsets:number[]=[];
 for(let index=0;index<value.length;index++){
  const character=value[index];
  if(/\s/.test(character)){if(!previousSpace&&text){text+=' ';offsets.push(index)}previousSpace=true;continue}
  text+=character.toLocaleLowerCase();offsets.push(index);previousSpace=false;
 }
 return{text:text.trimEnd(),offsets:offsets.slice(0,text.trimEnd().length)};
}

/** Accept only a bounded JSON keyword list whose phrases occur in the supplied page text. */
export function checkedPdfHighlightKeywords(reply:string,sourceText:string):string[]{
 const text=reply.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 let parsed:unknown;try{parsed=JSON.parse(text)}catch{throw new Error('The AI response was not a valid keyword list. Nothing was highlighted.')}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).length!==1||!Array.isArray((parsed as {keywords?:unknown}).keywords))throw new Error('The AI response did not contain a keyword list. Nothing was highlighted.');
 const keywords=(parsed as {keywords:unknown[]}).keywords;
 if(keywords.length<1||keywords.length>PDF_HIGHLIGHT_KEYWORD_LIMIT||keywords.some(item=>typeof item!=='string'||!item.trim()||item.trim().length>PDF_HIGHLIGHT_TERM_LENGTH_LIMIT))throw new Error('The AI keyword list was empty or exceeded its limits. Nothing was highlighted.');
 const normalizedSource=normalizedWithOffsets(sourceText).text,seen=new Set<string>(),checked:string[]=[];
 for(const raw of keywords as string[]){const keyword=raw.trim(),normalized=normalizedWithOffsets(keyword).text;if(seen.has(normalized)||!normalizedSource.includes(normalized))throw new Error('A suggested keyword was repeated or could not be matched to this PDF page. Nothing was highlighted.');seen.add(normalized);checked.push(keyword)}
 return checked;
}

/** Match keywords over adjacent PDF text spans and map each hit back to span offsets. */
export function findPdfHighlightRanges(spans:readonly string[],keywords:readonly string[]):PdfHighlightRange[]{
 let source='';const owners:Array<{spanIndex:number;offset:number}|null>=[];
 spans.forEach((span,spanIndex)=>{
  if(spanIndex&&source){source+=' ';owners.push(null)}
  for(let offset=0;offset<span.length;offset++){source+=span[offset];owners.push({spanIndex,offset})}
 });
 const normalizedSource=normalizedWithOffsets(source),matchSource=normalizedSource.text,matchOwners=normalizedSource.offsets.map(offset=>owners[offset]??null);
 const result:PdfHighlightRange[]=[],dedupe=new Set<string>();
 for(const keyword of keywords){const needle=normalizedWithOffsets(keyword).text;if(!needle)continue;let from=0;
  while(from<=matchSource.length-needle.length){const index=matchSource.indexOf(needle,from);if(index<0)break;from=index+Math.max(1,needle.length);
   let start=-1,previousOwner:{spanIndex:number;offset:number}|null=null;
   const flush=(end:number)=>{if(previousOwner&&start>=0){const key=`${previousOwner.spanIndex}:${start}:${end}:${keyword.toLocaleLowerCase()}`;if(!dedupe.has(key)){dedupe.add(key);result.push({spanIndex:previousOwner.spanIndex,start,end,keyword})}}};
   for(let cursor=index;cursor<index+needle.length;cursor++){
    const owner=matchOwners[cursor];if(!owner){if(previousOwner)flush(previousOwner.offset+1);start=-1;previousOwner=null;continue}
    if(!previousOwner||owner.spanIndex!==previousOwner.spanIndex||owner.offset!==previousOwner.offset+1){if(previousOwner)flush(previousOwner.offset+1);start=owner.offset;previousOwner=owner}else previousOwner=owner;
   }
   if(previousOwner)flush(previousOwner.offset+1);
  }
 }
 return result.sort((a,b)=>a.spanIndex-b.spanIndex||a.start-b.start||a.end-b.end);
}

export function pdfHighlightStorageKey(widgetId:string,path:string,fingerprint:string):string{
 return `still.pdf-highlights.v1.${encodeURIComponent(widgetId)}.${encodeURIComponent(path)}.${encodeURIComponent(fingerprint)}`;
}

export function readPdfHighlights(storage:Pick<Storage,'getItem'>,key:string):string[]{
 try{const raw=storage.getItem(key);if(!raw||raw.length>16_384)return[];const value:unknown=JSON.parse(raw);if(!Array.isArray(value)||value.length>PDF_HIGHLIGHT_KEYWORD_LIMIT||value.some(item=>typeof item!=='string'||!item.trim()||item.length>PDF_HIGHLIGHT_TERM_LENGTH_LIMIT))return[];return [...new Set(value as string[])]}catch{return[]}
}

export function writePdfHighlights(storage:Pick<Storage,'setItem'|'removeItem'>,key:string,keywords:readonly string[]):void{
 if(!keywords.length){storage.removeItem(key);return}
 if(keywords.length>PDF_HIGHLIGHT_KEYWORD_LIMIT||keywords.some(item=>typeof item!=='string'||!item.trim()||item.length>PDF_HIGHLIGHT_TERM_LENGTH_LIMIT))throw new Error('PDF highlights exceed the local storage limits.');
 storage.setItem(key,JSON.stringify(keywords));
}
