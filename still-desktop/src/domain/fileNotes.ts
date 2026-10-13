export const FILE_NOTE_LIMIT=40;
export const FILE_NOTE_LENGTH_LIMIT=4_000;
export const FILE_NOTE_TOTAL_LIMIT=80_000;

export function checkedFileNotes(value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 const result:Record<string,string>={};let total=0;
 for(const [key,note] of Object.entries(value)){
  if(key.length>500||typeof note!=='string'||Object.keys(result).length>=FILE_NOTE_LIMIT||total>=FILE_NOTE_TOTAL_LIMIT)continue;
  const text=note.slice(0,Math.min(FILE_NOTE_LENGTH_LIMIT,FILE_NOTE_TOTAL_LIMIT-total));result[key]=text;total+=text.length;
 }
 return result;
}
