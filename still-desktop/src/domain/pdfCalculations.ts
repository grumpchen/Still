export type PdfArithmeticOperation='+'|'-'|'×'|'÷';
export interface PdfCalculation {values:number[];operation:PdfArithmeticOperation}
const LIMIT=32;

export function togglePdfNumberSelection(ids:readonly string[],id:string,additive:boolean,limit=LIMIT):string[]|null{
 if(additive){
  if(ids.includes(id))return ids.filter(item=>item!==id);
  if(ids.length>=limit)return null;
  return [...ids,id];
 }
 return[id];
}

export function pdfOperationAt(dx:number,dy:number):PdfArithmeticOperation{
 const angle=Math.atan2(dy,dx);
 const index=Math.floor((angle+Math.PI/4+Math.PI*2)%(Math.PI*2)/(Math.PI/2));
 return(['+','-','×','÷'] as const)[index];
}

export function scanPdfNumbers(text:string):Array<{raw:string;value:number;start:number;end:number}>{
 const pattern=/(?<![\w.])[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?:\s*\/\s*\d+)?(?![\w.])/g;
 const found:Array<{raw:string;value:number;start:number;end:number}>=[];
 for(const match of text.matchAll(pattern)){
  const raw=match[0],normalized=raw.replace(/,/g,'').replace(/\s/g,'');
  const [numerator,denominator]=normalized.split('/');
  const top=Number(numerator),bottom=denominator===undefined?1:Number(denominator),value=top/bottom;
  if(!Number.isFinite(value)||bottom===0)continue;
  found.push({raw,value,start:match.index!,end:match.index!+raw.length});
 }
 return found;
}

export function checkedPdfCalculation(value:unknown):PdfCalculation|null{
 if(!value||typeof value!=='object')return null;
 const item=value as Partial<PdfCalculation>;
 if(!Array.isArray(item.values)||item.values.length<1||item.values.length>LIMIT||item.values.some(n=>typeof n!=='number'||!Number.isFinite(n)))return null;
 if(item.operation!=='+'&&item.operation!=='-'&&item.operation!=='×'&&item.operation!=='÷')return null;
 return{values:item.values,operation:item.operation};
}

export function calculatePdfValues(values:number[],operation:PdfArithmeticOperation):number{
 if(!values.length||values.length>LIMIT||values.some(value=>!Number.isFinite(value)))throw new Error('Select between 1 and 32 finite numbers.');
 const result=values.slice(1).reduce((result,value)=>{
  if(operation==='+')return result+value;
  if(operation==='-')return result-value;
  if(operation==='×')return result*value;
  if(value===0)throw new Error('Cannot divide by zero.');
  return result/value;
 },values[0]);
 if(!Number.isFinite(result))throw new Error('This calculation exceeds the supported numeric range.');
 return result;
}

export function encodePdfCalculation(values:number[],operation:PdfArithmeticOperation):string{
 const checked=checkedPdfCalculation({values,operation});
 if(!checked)throw new Error('Choose valid PDF numbers and an arithmetic operation.');
 return JSON.stringify(checked);
}

export function decodePdfCalculation(text:string):PdfCalculation|null{
 if(text.length>4096)return null;
 try{return checkedPdfCalculation(JSON.parse(text))}catch{return null}
}
