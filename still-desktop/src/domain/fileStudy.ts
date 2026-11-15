import type {NoteDocument} from './noteDocuments.ts';

export type ReadingStatus='unread'|'in-progress'|'done';
const statuses=new Set<ReadingStatus>(['unread','in-progress','done']);
export function checkedFileReadingStatus(value:unknown):Record<string,ReadingStatus>{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 const result:Record<string,ReadingStatus>={};
 for(const [path,status] of Object.entries(value).slice(-500)){
  if(!path||path.length>1000||path.startsWith('/')||/^[a-z]:/i.test(path)||path.split(/[\\/]/).some(part=>part==='.'||part==='..'||!part)||!statuses.has(status as ReadingStatus))continue;
  result[path]=status as ReadingStatus;
 }
 return result;
}

const ignored=new Set('about after again also another because before between could does doing each from have into its just more most other over same some such than that their them then there these they this those through under until very what when where which while with would your file source page'.split(' '));
function words(value:string){return [...new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]).filter(word=>!ignored.has(word)))].slice(0,250)}
export function findRelatedNotes(sourceName:string,sourceText:string,documents:readonly NoteDocument[],limit=3):NoteDocument[]{
 const terms=words(`${sourceName} ${sourceText.slice(0,24000)}`);if(!terms.length)return[];
 return documents.map(document=>{const title=new Set(words(document.title)),body=new Set(words(document.text.slice(0,16000))),score=terms.reduce((total,word)=>total+(title.has(word)?4:0)+(body.has(word)?1:0),0);return{document,score}}).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.document.title.localeCompare(b.document.title)).slice(0,Math.max(0,Math.min(10,limit))).map(item=>item.document);
}

export interface StudyQuestion {question:string;answer:string}
export function parseStudyQuestions(value:string):StudyQuestion[]{
 const text=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');let raw:unknown;
 try{raw=JSON.parse(text)}catch{const start=text.indexOf('['),end=text.lastIndexOf(']');if(start<0||end<=start)return[];try{raw=JSON.parse(text.slice(start,end+1))}catch{return[]}}
 if(!Array.isArray(raw))return[];const result:StudyQuestion[]=[];
 for(const item of raw){if(!item||typeof item!=='object')continue;const question=(item as Record<string,unknown>).question,answer=(item as Record<string,unknown>).answer;if(typeof question!=='string'||typeof answer!=='string')continue;const q=question.trim().slice(0,360),a=answer.trim().slice(0,700);if(!q||!a)continue;result.push({question:q,answer:a});if(result.length>=8)break}
 return result;
}
export function formatStudyQuestions(questions:readonly StudyQuestion[]):string{return questions.map((item,index)=>`${index+1}. ${item.question}\n   Answer: ${item.answer}`).join('\n\n')}
