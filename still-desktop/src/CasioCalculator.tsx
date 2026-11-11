import {useEffect,useMemo,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import type {WidgetProps} from './widgets.tsx';
import {
 evaluate,formatValue,formatNumber,formatFraction,formatMatrix,formatVector,toFraction,
 stat1,stat2,solveLinear2,solveLinear3,solveQuadratic,solveCubic,
 matrixAdd,matrixSub,matrixMul,matrixTranspose,matrixDet,matrixInverse,
 vectorAdd,vectorSub,vectorDot,vectorCross,vectorNorm,vectorUnit,
 numericIntegral,numericDerivative,solveEquation,
 physicalConstants,unitConversions,convertUnit,
 type Num,type Matrix,type AngleUnit,type DisplayMode,type EvalOptions,type FormatOptions,
} from './domain/casioMath.ts';

type Mode='COMP'|'STAT'|'CMPLX'|'EQN'|'MAT'|'VCT'|'TABLE'|'CONST'|'CONV';
type Panel='none'|'stat'|'eqn'|'mat'|'vct'|'table'|'const'|'conv'|'calc'|'solve'|'integral'|'derivative';

const MODES:{id:Mode;label:string;hint:string}[]=[
 {id:'COMP',label:'COMP',hint:'General'},
 {id:'STAT',label:'STAT',hint:'Statistics'},
 {id:'CMPLX',label:'CMPLX',hint:'Complex'},
 {id:'EQN',label:'EQN',hint:'Equations'},
 {id:'MAT',label:'MAT',hint:'Matrices'},
 {id:'VCT',label:'VCT',hint:'Vectors'},
 {id:'TABLE',label:'TABLE',hint:'Table'},
 {id:'CONST',label:'CONST',hint:'Constants'},
 {id:'CONV',label:'CONV',hint:'Conversions'},
];
const ALPHA_DIGITS:Record<string,string>={7:'A',8:'B',9:'C',4:'D',5:'E',6:'F',1:'X',2:'Y',3:'M'};
const DISPLAY_PRESETS:{label:string;value:DisplayMode}[]=[
 {label:'NORM1',value:{kind:'NORM',digits:1}},
 {label:'NORM2',value:{kind:'NORM',digits:2}},
 {label:'FIX2',value:{kind:'FIX',digits:2}},
 {label:'FIX3',value:{kind:'FIX',digits:3}},
 {label:'SCI3',value:{kind:'SCI',digits:3}},
 {label:'SCI4',value:{kind:'SCI',digits:4}},
];
const EQN_LABELS:Record<string,string[]>={
 simul2:['a1','b1','c1','a2','b2','c2'],
 simul3:['a1','b1','c1','d1','a2','b2','c2','d2','a3','b3','c3','d3'],
 degree2:['a','b','c'],
 degree3:['a','b','c','d'],
};

interface FieldEntry{el:HTMLInputElement;set:(value:string)=>void}
// The panel slot the user picked, and the React setter for every slot element.
// Tracking the picked element directly (instead of relying on focus staying put)
// lets the on-screen keypad type into a slot even though key presses are buttons.
let selectedField:HTMLInputElement|null=null;
let replaceOnNextKey=false;
const fieldSetters=new WeakMap<HTMLInputElement,(value:string)=>void>();
const FIELD_TEXT:Record<string,string>={'×':'*','÷':'/','⁻¹':'^-1','²':'^2','³':'^3'};

function fieldText(text:string):string|null{
 if(text in FIELD_TEXT)return FIELD_TEXT[text];
 return /^[0-9.+\-*/^()%E]$/.test(text)?text:null;
}

// Move focus to the next slot in the same panel, then to the panel's main action.
function focusNextField(el:HTMLInputElement){
 const scope=el.closest('.casio-panel');
 if(!scope){el.blur();return}
 const inputs=Array.from(scope.querySelectorAll('input'));
 const index=inputs.indexOf(el);
 const next=inputs[index+1];
 if(next){next.focus();return}
 const primary=scope.querySelector<HTMLButtonElement>('button.primary');
 if(primary){primary.click();return}
 el.blur();
}

// Text slot used by every mode panel. Remembers the slot when it is clicked or
// focused so the on-screen keypad can type into it, and Enter jumps to the next.
function PanelInput({value,onChange,label,className}:{
 value:string;onChange:(value:string)=>void;label?:string;className?:string;
}){
 const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{const el=ref.current;if(el)fieldSetters.set(el,onChange)},[onChange]);
 useEffect(()=>()=>{const el=ref.current;if(el)fieldSetters.delete(el)},[]);
 return <input ref={ref} className={className} value={value} inputMode="decimal" aria-label={label}
  onChange={event=>{replaceOnNextKey=false;onChange(event.target.value)}}
  onPointerDown={event=>{selectedField=event.currentTarget;replaceOnNextKey=true}}
  onFocus={event=>{selectedField=event.currentTarget;replaceOnNextKey=true;event.currentTarget.select()}}
  onKeyDown={event=>{
   if(event.key==='Enter'){event.preventDefault();focusNextField(event.currentTarget)}
   else if(event.key==='Escape'){event.preventDefault();selectedField=null;event.currentTarget.blur()}
  }}/>;
}

function Key({label,shiftLabel,alphaLabel,tone,onPress}:{
 label:string;shiftLabel?:string;alphaLabel?:string;tone?:string;onPress:()=>void;
}){
 return <button type="button" className={`casio-key${tone?' casio-'+tone:''}`}
  onMouseDown={event=>event.preventDefault()}
  onClick={onPress}>
  {shiftLabel&&<span className="casio-key-shift">{shiftLabel}</span>}
  {alphaLabel&&<span className="casio-key-alpha">{alphaLabel}</span>}
  <span className="casio-key-face">{label}</span>
 </button>;
}

function Panel({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 return <div className="casio-panel">
  <div className="casio-panel-head"><strong>{title}</strong><button type="button" className="casio-panel-close" aria-label="Close" onClick={close}>×</button></div>
  {children}
 </div>;
}

function Field({label,value,onChange,wide}:{label:string;value:string;onChange:(value:string)=>void;wide?:boolean}){
 return <label className={`casio-field${wide?' casio-field-wide':''}`}><span>{label}</span><PanelInput value={value} onChange={onChange} label={label}/></label>;
}

export default function CasioCalculator({workspaceActive}:WidgetProps){
 const root=useRef<HTMLDivElement>(null);
 const expressionLine=useRef<HTMLDivElement>(null);
 const [mode,setMode]=useState<Mode>('COMP');
 const [panel,setPanel]=useState<Panel>('none');
 const [modeMenu,setModeMenu]=useState(false);
 const [input,setInput]=useState('');
 const [cursor,setCursor]=useState(0);
 const [result,setResult]=useState('');
 const [message,setMessage]=useState('');
 const [justEvaluated,setJustEvaluated]=useState(false);
 const [shift,setShift]=useState(false);
 const [alpha,setAlpha]=useState(false);
 const [hyp,setHyp]=useState(false);
 const [pending,setPending]=useState<'store'|'recall'|null>(null);
 const [angle,setAngle]=useState<AngleUnit>('DEG');
 const [display,setDisplay]=useState<DisplayMode>({kind:'NORM',digits:1});
 const [fraction,setFraction]=useState(false);
 const [improper,setImproper]=useState(false);
 const [sexagesimal,setSexagesimal]=useState(false);
 const [engineering,setEngineering]=useState(false);
 const [variables,setVariables]=useState<Record<string,number>>({A:0,B:0,C:0,D:0,E:0,F:0,X:0,Y:0});
 const [memory,setMemory]=useState(0);
 const [ans,setAns]=useState<Num>(0);
 const [history,setHistory]=useState<string[]>([]);
 const [historyIndex,setHistoryIndex]=useState(-1);
 const [sexaStage,setSexaStage]=useState(0);

 // STAT
 const [statType,setStatType]=useState<'1VAR'|'2VAR'>('1VAR');
 const [statRows,setStatRows]=useState<{x:string;y:string;freq:string}[]>([{x:'',y:'',freq:''}]);
 // EQN
 const [eqnType,setEqnType]=useState<'simul2'|'simul3'|'degree2'|'degree3'>('degree2');
 const [eqnCoeffs,setEqnCoeffs]=useState<string[]>(['','','']);
 const [eqnResult,setEqnResult]=useState<string[]>([]);
 // MAT
 const [matrixName,setMatrixName]=useState<'A'|'B'|'C'>('A');
 const [matrixSize,setMatrixSize]=useState(2);
 const [matrices,setMatrices]=useState<Record<'A'|'B'|'C',string[][]>>({
  A:Array.from({length:3},()=>Array(3).fill('0')),
  B:Array.from({length:3},()=>Array(3).fill('0')),
  C:Array.from({length:3},()=>Array(3).fill('0')),
 });
 const [matrixResult,setMatrixResult]=useState('');
 const [matrixLast,setMatrixLast]=useState<Matrix|null>(null);
 // VCT
 const [vectorName,setVectorName]=useState<'A'|'B'|'C'>('A');
 const [vectorSize,setVectorSize]=useState(3);
 const [vectors,setVectors]=useState<Record<'A'|'B'|'C',string[]>>({A:['0','0','0'],B:['0','0','0'],C:['0','0','0']});
 const [vectorResult,setVectorResult]=useState('');
 // TABLE
 const [tableFunction,setTableFunction]=useState('X^2');
 const [tableStart,setTableStart]=useState('1');
 const [tableEnd,setTableEnd]=useState('5');
 const [tableStep,setTableStep]=useState('1');
 const [tableRows,setTableRows]=useState<{x:number;y:number}[]>([]);
 // CONST / CONV
 const [constantSearch,setConstantSearch]=useState('');
 const [conversionCategory,setConversionCategory]=useState(0);
 const [conversionFrom,setConversionFrom]=useState(0);
 const [conversionTo,setConversionTo]=useState(1);
 const [conversionValue,setConversionValue]=useState('1');
 // CALC / SOLVE / INTEGRAL / DERIVATIVE
 const [calcValues,setCalcValues]=useState<Record<string,string>>({});
 const [calcResult,setCalcResult]=useState('');
 const [solveGuess,setSolveGuess]=useState('0');
 const [solveResult,setSolveResult]=useState('');
 const [integralLower,setIntegralLower]=useState('0');
 const [integralUpper,setIntegralUpper]=useState('1');
 const [integralResult,setIntegralResult]=useState('');
 const [derivativePoint,setDerivativePoint]=useState('0');
 const [derivativeResult,setDerivativeResult]=useState('');

 const evalOptions=useMemo<EvalOptions>(()=>({angle,variables,memory,ans,complex:mode==='CMPLX'}),[angle,variables,memory,ans,mode]);
 const formatOptions=useMemo<FormatOptions>(()=>({display,fraction,improper,sexagesimal,engineering}),[display,fraction,improper,sexagesimal,engineering]);
 const preview=useMemo(()=>{
  if(!input.trim()||justEvaluated)return '';
  try{return formatValue(evaluate(input,evalOptions),formatOptions)}catch{return ''}
 },[input,justEvaluated,evalOptions,formatOptions]);

 useEffect(()=>{
  const line=expressionLine.current;
  if(line)line.scrollLeft=line.scrollWidth;
 },[input,cursor]);

 useEffect(()=>{
  if(mode==='STAT')setPanel('stat');
  else if(mode==='EQN')setPanel('eqn');
  else if(mode==='MAT')setPanel('mat');
  else if(mode==='VCT')setPanel('vct');
  else if(mode==='TABLE')setPanel('table');
  else if(mode==='CONST')setPanel('const');
  else if(mode==='CONV')setPanel('conv');
  else setPanel('none');
 },[mode]);

 const numberValue=(text:string,fallback=NaN)=>text.trim()===''?fallback:Number(text);
 const realPart=(value:Num):number=>typeof value==='number'?value:value.re;
 const literal=(value:number)=>Number.isFinite(value)?String(value).replace('e','E'):'0';
 const numText=(value:number)=>{try{return formatNumber(value,display,engineering)}catch{return 'Math ERROR'}};
 const valueText=(value:Num)=>{try{return formatValue(value,formatOptions)}catch{return 'Math ERROR'}};

 function clearMods(){setShift(false);setAlpha(false);setHyp(false)}
 function activeField():FieldEntry|null{
  const el=selectedField;
  if(!el||!el.isConnected||el.closest('.casio570')!==root.current)return null;
  const set=fieldSetters.get(el);
  return set?{el,set}:null;
 }
 function fieldCaret(entry:FieldEntry){
  const el=entry.el;
  const start=el.selectionStart??el.value.length;
  return {start,end:el.selectionEnd??start};
 }
 function writeField(entry:FieldEntry,next:string,caret:number){
  entry.set(next);
  const apply=()=>{
   const el=entry.el;
   el.focus();
   try{el.setSelectionRange(caret,caret)}catch{/* jsdom and old browsers may not support it */}
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(apply);
  else setTimeout(apply,0);
 }
 function insertIntoField(text:string){
  const entry=activeField();
  if(!entry)return false;
  const mapped=fieldText(text);
  if(mapped===null)return false;
  const value=entry.el.value;
  const {start,end}=replaceOnNextKey?{start:0,end:value.length}:fieldCaret(entry);
  replaceOnNextKey=false;
  writeField(entry,value.slice(0,start)+mapped+value.slice(end),start+mapped.length);
  return true;
 }
 function fieldBackspace(){
  const entry=activeField();
  if(!entry)return false;
  replaceOnNextKey=false;
  const {start,end}=fieldCaret(entry);
  const value=entry.el.value;
  if(start===0&&end===0)return true;
  const caret=start===end?Math.max(0,start-1):start;
  const next=start===end?value.slice(0,caret)+value.slice(end):value.slice(0,start)+value.slice(end);
  writeField(entry,next,caret);
  return true;
 }
 function fieldClear(){
  const entry=activeField();
  if(!entry)return false;
  replaceOnNextKey=false;
  writeField(entry,'',0);
  return true;
 }
 function insert(text:string){
  if(insertIntoField(text))return;
  setMessage('');
  setResult('');
  const continues=justEvaluated&&(/^[+\-*/^!%),]$/.test(text)||text==='⁻¹'||text==='²'||text==='³');
  const base=justEvaluated?(continues?'Ans':''):input;
  const at=justEvaluated?base.length:Math.min(cursor,input.length);
  setInput(base.slice(0,at)+text+base.slice(at));
  setCursor(at+text.length);
  setJustEvaluated(false);
  setHistoryIndex(-1);
 }
 function insertLiteral(value:number){insert(literal(value))}
 function backspace(){
  setMessage('');setResult('');
  if(justEvaluated)setJustEvaluated(false);
  const at=Math.min(cursor,input.length);
  if(at<=0)return;
  setInput(input.slice(0,at-1)+input.slice(at));
  setCursor(at-1);
 }
 function clearAll(){
  setInput('');setCursor(0);setResult('');setMessage('');setJustEvaluated(false);setPending(null);setHistoryIndex(-1);setSexaStage(0);
 }
 function hardReset(){
  clearAll();setVariables({A:0,B:0,C:0,D:0,E:0,F:0,X:0,Y:0});setMemory(0);setAns(0);setMode('COMP');setPanel('none');setModeMenu(false);
 }
 function currentReal(){
  try{return realPart(evaluate(input||'Ans',evalOptions))}catch{return realPart(ans)}
 }
 function storeTo(letter:string){
  const value=currentReal();
  if(letter==='M')setMemory(value);
  else setVariables(previous=>({...previous,[letter]:value}));
  setPending(null);setMessage(`→ ${letter}`);setShift(false);setAlpha(false);
 }
 function recallFrom(letter:string){
  const value=letter==='M'?memory:variables[letter]??0;
  insert(literal(value));setPending(null);setMessage(`RCL ${letter}`);setShift(false);setAlpha(false);
 }
 function variableInput(letter:string){
  if(pending==='store'){storeTo(letter);return}
  if(pending==='recall'){recallFrom(letter);return}
  insert(letter);
 }
 function memoryAdd(sign:1|-1){
  const value=currentReal();
  setMemory(previous=>previous+sign*value);
  setMessage(sign>0?'M+':'M−');
 }
 function calculate(){
  const expression=input.trim();
  if(!expression)return;
  try{
   let value:Num;
   if(expression.includes('=')){
    const [left,right]=expression.split('=');
    const target=(x:number)=>realPart(evaluate(`(${left})-(${right})`,{...evalOptions,variables:{...variables,X:x}}));
    const root=solveEquation(target,variables.X||0);
    if(root===null)throw new Error('No root');
    setVariables(previous=>({...previous,X:root}));
    value=root;
   }else{
    value=evaluate(expression,evalOptions);
   }
   setAns(value);
   setResult(valueText(value));
   setHistory(previous=>[...previous,expression].slice(-40));
   setHistoryIndex(-1);
   setJustEvaluated(true);
   setMessage('');
  }catch(error){
   setResult('');
   setMessage(error instanceof Error?error.message:'Math ERROR');
  }
 }
 function historyPrevious(){
  if(!history.length)return;
  const next=historyIndex<0?history.length-1:Math.max(0,historyIndex-1);
  setHistoryIndex(next);setInput(history[next]);setCursor(history[next].length);setJustEvaluated(false);setResult('');
 }
 function historyNext(){
  if(historyIndex<0)return;
  const next=historyIndex+1;
  if(next>=history.length){setHistoryIndex(-1);setInput('');setCursor(0)}
  else{setHistoryIndex(next);setInput(history[next]);setCursor(history[next].length)}
  setJustEvaluated(false);setResult('');
 }
 function chooseMode(next:Mode){
  setMode(next);setModeMenu(false);setMessage('');setResult('');setJustEvaluated(false);clearMods();
 }
 function closePanel(){
  setPanel('none');
  if(mode!=='COMP'&&mode!=='CMPLX')setMode('COMP');
 }
 function toggleShift(){setShift(value=>!value);setAlpha(false)}
 function toggleAlpha(){setAlpha(value=>!value);setShift(false)}
 function trig(name:'sin'|'cos'|'tan',inverse:boolean,hyperbolic:boolean){
  insert(`${inverse?'a':''}${name}${hyperbolic?'h':''}(`);
  clearMods();
 }
 function sexagesimalMark(){
  const marks=['°','′','″'];
  insert(marks[sexaStage%3]);
  setSexaStage((sexaStage+1)%3);
 }
 function digit(key:string,mods:{alpha:boolean}){
  if(mods.alpha||pending){
   const letter=ALPHA_DIGITS[key];
   if(letter){variableInput(letter);return}
  }
  insert(key);
 }
 function handleKeyDown(event:KeyboardEvent<HTMLDivElement>){
  if(!workspaceActive)return;
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const key=event.key;
  if(/^[0-9]$/.test(key)){event.preventDefault();digit(key,{alpha});return}
  if(/^[a-fA-F]$/.test(key)){event.preventDefault();variableInput(key.toUpperCase());return}
  if(/^[xyXYmM]$/.test(key)){event.preventDefault();variableInput(key.toUpperCase());return}
  switch(key){
   case '+':case '-':case '*':case '/':case '^':case '(':case ')':case '.':case ',':case '%':case '!':
    event.preventDefault();insert(key);return;
   case 'Enter':case '=':
    if(key==='Enter'&&(event.target as HTMLElement).closest('button'))return;
    event.preventDefault();calculate();return;
   case 'Backspace':
    event.preventDefault();backspace();return;
   case 'Delete':
    event.preventDefault();clearAll();return;
   case 'Escape':
    event.preventDefault();
    if(modeMenu)setModeMenu(false);
    else if(panel!=='none')closePanel();
    else clearAll();
    return;
   case 'ArrowLeft':
    event.preventDefault();setCursor(value=>Math.max(0,Math.min(input.length,value-1)));return;
   case 'ArrowRight':
    event.preventDefault();setCursor(value=>Math.min(input.length,value+1));return;
   case 'ArrowUp':
    event.preventDefault();historyPrevious();return;
   case 'ArrowDown':
    event.preventDefault();historyNext();return;
   default:return;
  }
 }

 function renderStatPanel(){
  const parsed=statRows.map(row=>({x:numberValue(row.x),y:numberValue(row.y),freq:numberValue(row.freq,1)}));
  const one=statType==='1VAR'?stat1(parsed):null;
  const two=statType==='2VAR'?stat2(parsed):null;
  return <Panel title="STAT" close={closePanel}>
   <div className="casio-panel-actions">
    <button type="button" className={statType==='1VAR'?'active':''} onClick={()=>setStatType('1VAR')}>1-VAR</button>
    <button type="button" className={statType==='2VAR'?'active':''} onClick={()=>setStatType('2VAR')}>2-VAR</button>
    <button type="button" onClick={()=>setStatRows(previous=>[...previous,{x:'',y:'',freq:''}])}>+ Row</button>
    <button type="button" onClick={()=>setStatRows([{x:'',y:'',freq:''}])}>CLR</button>
   </div>
   <div className={`casio-stat-row casio-stat-header${statType==='2VAR'?' two':''}`}><span>#</span><span>x</span>{statType==='2VAR'&&<span>y</span>}<span>Freq</span><span/></div>
   {statRows.map((row,index)=><div key={index} className={`casio-stat-row${statType==='2VAR'?' two':''}`}>
    <span>{index+1}</span>
    <PanelInput value={row.x} label={`x${index+1}`} onChange={value=>setStatRows(previous=>previous.map((item,position)=>position===index?{...item,x:value}:item))}/>
    {statType==='2VAR'&&<PanelInput value={row.y} label={`y${index+1}`} onChange={value=>setStatRows(previous=>previous.map((item,position)=>position===index?{...item,y:value}:item))}/>}
    <PanelInput value={row.freq} label={`freq${index+1}`} onChange={value=>setStatRows(previous=>previous.map((item,position)=>position===index?{...item,freq:value}:item))}/>
    <button type="button" className="casio-row-remove" onClick={()=>setStatRows(previous=>previous.length>1?previous.filter((_item,position)=>position!==index):previous)}>×</button>
   </div>)}
   {one&&<div className="casio-grid-results">
    <span>n</span><b>{numText(one.n)}</b><span>Σx</span><b>{numText(one.sum)}</b>
    <span>Σx²</span><b>{numText(one.sum2)}</b><span>x̄</span><b>{numText(one.mean)}</b>
    <span>σx</span><b>{numText(one.populationSd)}</b><span>sx</span><b>{numText(one.sampleSd)}</b>
    <span>min</span><b>{numText(one.min)}</b><span>Q1</span><b>{numText(one.q1)}</b>
    <span>med</span><b>{numText(one.median)}</b><span>Q3</span><b>{numText(one.q3)}</b>
    <span>max</span><b>{numText(one.max)}</b>
   </div>}
   {two&&<div className="casio-grid-results">
    <span>n</span><b>{numText(two.n)}</b><span>Σx</span><b>{numText(two.sumX)}</b>
    <span>Σy</span><b>{numText(two.sumY)}</b><span>Σxy</span><b>{numText(two.sumXY)}</b>
    <span>x̄</span><b>{numText(two.meanX)}</b><span>ȳ</span><b>{numText(two.meanY)}</b>
    <span>σx</span><b>{numText(two.populationSdX)}</b><span>σy</span><b>{numText(two.populationSdY)}</b>
    <span>sx</span><b>{numText(two.sampleSdX)}</b><span>sy</span><b>{numText(two.sampleSdY)}</b>
    <span>r</span><b>{numText(two.r)}</b><span>a</span><b>{numText(two.a)}</b>
    <span>b</span><b>{numText(two.b)}</b>
   </div>}
  </Panel>;
 }

 function renderEqnPanel(){
  const labels=EQN_LABELS[eqnType];
  const eqnColumns=eqnType==='simul3'||eqnType==='degree3'?4:3;
  function solve(){
   const coefficients=eqnCoeffs.map(value=>numberValue(value,0));
   try{
    let roots:Num[]=[];
    if(eqnType==='simul2'){
     const result=solveLinear2(coefficients[0],coefficients[1],coefficients[2],coefficients[3],coefficients[4],coefficients[5]);
     if(!result)throw new Error('No solution');
     roots=result;
    }else if(eqnType==='simul3'){
     const result=solveLinear3([0,1,2].map(row=>[coefficients[row*4],coefficients[row*4+1],coefficients[row*4+2],coefficients[row*4+3]]));
     if(!result)throw new Error('No solution');
     roots=result;
    }else if(eqnType==='degree2')roots=solveQuadratic(coefficients[0],coefficients[1],coefficients[2]);
    else roots=solveCubic(coefficients[0],coefficients[1],coefficients[2],coefficients[3]);
    setEqnResult(roots.length?roots.map((root,index)=>`x${roots.length>1?index+1:''} = ${valueText(root)}`):['No solution']);
   }catch(error){setEqnResult([error instanceof Error?error.message:'Math ERROR'])}
  }
  return <Panel title="EQN" close={closePanel}>
   <div className="casio-panel-actions">
    {([['simul2','2 unknowns'],['simul3','3 unknowns'],['degree2','Degree 2'],['degree3','Degree 3']] as const).map(([id,label])=>
     <button key={id} type="button" className={eqnType===id?'active':''} onClick={()=>{setEqnType(id);setEqnCoeffs(Array(EQN_LABELS[id].length).fill(''));setEqnResult([])}}>{label}</button>)}
   </div>
   <div className="casio-field-scroll">
    <div className="casio-eqn-grid" style={{gridTemplateColumns:`repeat(${eqnColumns},minmax(72px,1fr))`}}>
     {labels.map((label,index)=><Field key={label} label={label} value={eqnCoeffs[index]??''} onChange={value=>setEqnCoeffs(previous=>previous.map((item,position)=>position===index?value:item))}/>)}
    </div>
   </div>
   {eqnColumns===4&&<div className="casio-panel-note">Four coefficients per row — scroll sideways if the last column is cut off.</div>}
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={solve}>SOLVE</button></div>
   {eqnResult.length>0&&<div className="casio-panel-result">{eqnResult.map((line,index)=><div key={index}>{line}</div>)}</div>}
  </Panel>;
 }

 function readMatrix(name:'A'|'B'|'C'):Matrix{
  return Array.from({length:matrixSize},(_v,row)=>Array.from({length:matrixSize},(_w,column)=>numberValue(matrices[name][row][column],0)));
 }
 function applyMatrix(operation:()=>Matrix|number|string){
  try{
   const value=operation();
   if(typeof value==='number'){setMatrixLast(null);setMatrixResult(numText(value))}
   else if(typeof value==='string'){setMatrixLast(null);setMatrixResult(value)}
   else{setMatrixLast(value);setMatrixResult(formatMatrix(value))}
  }catch(error){setMatrixLast(null);setMatrixResult(error instanceof Error?error.message:'Math ERROR')}
 }
 function renderMatPanel(){
  const active=matrices[matrixName];
  return <Panel title="MAT" close={closePanel}>
   <div className="casio-panel-actions">
    {(['A','B','C'] as const).map(name=><button key={name} type="button" className={matrixName===name?'active':''} onClick={()=>setMatrixName(name)}>{name}</button>)}
    <button type="button" className={matrixSize===2?'active':''} onClick={()=>setMatrixSize(2)}>2×2</button>
    <button type="button" className={matrixSize===3?'active':''} onClick={()=>setMatrixSize(3)}>3×3</button>
   </div>
   <div className="casio-matrix-grid" style={{gridTemplateColumns:`repeat(${matrixSize},minmax(0,1fr))`}}>
    {Array.from({length:matrixSize},(_v,row)=>Array.from({length:matrixSize},(_w,column)=>
     <PanelInput key={`${row}-${column}`} value={active[row][column]} label={`${matrixName}${row+1}${column+1}`}
      onChange={value=>setMatrices(previous=>({...previous,[matrixName]:previous[matrixName].map((item,rowIndex)=>rowIndex===row?item.map((cell,columnIndex)=>columnIndex===column?value:cell):item)}))}/>))}
   </div>
   <div className="casio-panel-actions">
    <button type="button" onClick={()=>applyMatrix(()=>matrixAdd(readMatrix('A'),readMatrix('B')))}>A+B</button>
    <button type="button" onClick={()=>applyMatrix(()=>matrixSub(readMatrix('A'),readMatrix('B')))}>A−B</button>
    <button type="button" onClick={()=>applyMatrix(()=>matrixMul(readMatrix('A'),readMatrix('B')))}>A×B</button>
    <button type="button" onClick={()=>applyMatrix(()=>matrixDet(readMatrix(matrixName)))}>det {matrixName}</button>
    <button type="button" onClick={()=>applyMatrix(()=>matrixInverse(readMatrix(matrixName)))}>{matrixName}⁻¹</button>
    <button type="button" onClick={()=>applyMatrix(()=>matrixTranspose(readMatrix(matrixName)))}>{matrixName}ᵀ</button>
    <button type="button" onClick={()=>{if(matrixLast){setMatrices(previous=>({...previous,C:matrixLast.map(row=>row.map(value=>literal(value)))}));setMatrixName('C');setMatrixSize(matrixLast.length)}}}>→C</button>
   </div>
   {matrixResult&&<pre className="casio-panel-result">{matrixResult}</pre>}
  </Panel>;
 }

 function readVector(name:'A'|'B'|'C'):number[]{
  return Array.from({length:vectorSize},(_v,index)=>numberValue(vectors[name][index],0));
 }
 function applyVector(operation:()=>number[]|number|string){
  try{
   const value=operation();
   if(typeof value==='number')setVectorResult(numText(value));
   else if(typeof value==='string')setVectorResult(value);
   else setVectorResult(formatVector(value));
  }catch(error){setVectorResult(error instanceof Error?error.message:'Math ERROR')}
 }
 function renderVctPanel(){
  const active=vectors[vectorName];
  return <Panel title="VCT" close={closePanel}>
   <div className="casio-panel-actions">
    {(['A','B','C'] as const).map(name=><button key={name} type="button" className={vectorName===name?'active':''} onClick={()=>setVectorName(name)}>{name}</button>)}
    <button type="button" className={vectorSize===2?'active':''} onClick={()=>setVectorSize(2)}>2D</button>
    <button type="button" className={vectorSize===3?'active':''} onClick={()=>setVectorSize(3)}>3D</button>
   </div>
   <div className="casio-matrix-grid" style={{gridTemplateColumns:`repeat(${vectorSize},minmax(0,1fr))`}}>
    {Array.from({length:vectorSize},(_v,index)=>
     <PanelInput key={index} value={active[index]} label={`${vectorName}${index+1}`}
      onChange={value=>setVectors(previous=>({...previous,[vectorName]:previous[vectorName].map((item,position)=>position===index?value:item)}))}/>)}
   </div>
   <div className="casio-panel-actions">
    <button type="button" onClick={()=>applyVector(()=>vectorAdd(readVector('A'),readVector('B')))}>A+B</button>
    <button type="button" onClick={()=>applyVector(()=>vectorSub(readVector('A'),readVector('B')))}>A−B</button>
    <button type="button" onClick={()=>applyVector(()=>vectorDot(readVector('A'),readVector('B')))}>A·B</button>
    <button type="button" onClick={()=>applyVector(()=>vectorCross(readVector('A'),readVector('B')))}>A×B</button>
    <button type="button" onClick={()=>applyVector(()=>vectorNorm(readVector(vectorName)))}>|{vectorName}|</button>
    <button type="button" onClick={()=>applyVector(()=>vectorUnit(readVector(vectorName)))}>unit {vectorName}</button>
   </div>
   {vectorResult&&<pre className="casio-panel-result">{vectorResult}</pre>}
  </Panel>;
 }

 function renderTablePanel(){
  function generate(){
   const start=numberValue(tableStart,0),end=numberValue(tableEnd,10),step=numberValue(tableStep,1);
   if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(step)||step===0)return;
   const rows:{x:number;y:number}[]=[];
   for(let index=0;index<45;index++){
    const x=start+index*step;
    if(step>0?x>end+1e-12:x<end-1e-12)break;
    try{rows.push({x,y:realPart(evaluate(tableFunction,{...evalOptions,variables:{...variables,X:x}}))})}
    catch{rows.push({x,y:NaN})}
   }
   setTableRows(rows);
  }
  return <Panel title="TABLE" close={closePanel}>
   <Field label="f(x)" value={tableFunction} onChange={setTableFunction} wide/>
   <div className="casio-field-grid">
    <Field label="Start" value={tableStart} onChange={setTableStart}/>
    <Field label="End" value={tableEnd} onChange={setTableEnd}/>
    <Field label="Step" value={tableStep} onChange={setTableStep}/>
   </div>
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={generate}>GENERATE</button></div>
   {tableRows.length>0&&<div className="casio-table">
    <div className="casio-table-row casio-table-head"><span>x</span><span>f(x)</span></div>
    {tableRows.map((row,index)=><div key={index} className="casio-table-row"><span>{numText(row.x)}</span><span>{Number.isFinite(row.y)?numText(row.y):'ERROR'}</span></div>)}
   </div>}
  </Panel>;
 }

 function renderConstPanel(){
  const search=constantSearch.trim().toLowerCase();
  const constants=physicalConstants.filter(item=>!search||item.name.toLowerCase().includes(search)||item.symbol.toLowerCase().includes(search));
  return <Panel title="CONST" close={closePanel}>
   <input className="casio-search" placeholder="Search constants…" value={constantSearch} onChange={event=>setConstantSearch(event.target.value)}/>
   <div className="casio-list">
    {constants.map(item=><button key={item.symbol+item.name} type="button" className="casio-list-item" onClick={()=>insertLiteral(item.value)}>
     <b>{item.symbol}</b><span>{item.name}</span><small>{item.value.toExponential(6).replace('e','E')} {item.unit}</small>
    </button>)}
   </div>
  </Panel>;
 }

 function renderConvPanel(){
  const category=unitConversions[conversionCategory];
  const from=category.units[Math.min(conversionFrom,category.units.length-1)];
  const to=category.units[Math.min(conversionTo,category.units.length-1)];
  const value=numberValue(conversionValue,0);
  let converted=NaN;
  try{converted=convertUnit(category,from,to,value)}catch{converted=NaN}
  return <Panel title="CONV" close={closePanel}>
   <label className="casio-field casio-field-wide"><span>Category</span>
    <select value={conversionCategory} onChange={event=>{const index=Number(event.target.value);setConversionCategory(index);setConversionFrom(0);setConversionTo(Math.min(1,unitConversions[index].units.length-1))}}>
     {unitConversions.map((item,index)=><option key={item.name} value={index}>{item.name}</option>)}
    </select>
   </label>
   <div className="casio-field-grid">
    <label className="casio-field"><span>From</span>
     <select value={conversionFrom} onChange={event=>setConversionFrom(Number(event.target.value))}>
      {category.units.map((unit,index)=><option key={unit.name} value={index}>{unit.name} ({unit.symbol})</option>)}
     </select>
    </label>
    <label className="casio-field"><span>To</span>
     <select value={conversionTo} onChange={event=>setConversionTo(Number(event.target.value))}>
      {category.units.map((unit,index)=><option key={unit.name} value={index}>{unit.name} ({unit.symbol})</option>)}
     </select>
    </label>
   </div>
   <div className="casio-field-grid">
    <Field label="Value" value={conversionValue} onChange={setConversionValue}/>
    <div className="casio-field"><span>Result</span><b className="casio-readout">{Number.isFinite(converted)?numText(converted):'ERROR'}</b></div>
   </div>
   <div className="casio-panel-actions"><button type="button" className="primary" disabled={!Number.isFinite(converted)} onClick={()=>insertLiteral(converted)}>INSERT RESULT</button></div>
  </Panel>;
 }

 function renderCalcPanel(){
  const names=Array.from(new Set([...variablesInLocal(input),...Object.keys(calcValues)])).sort();
  function run(){
   const values={...variables};
   for(const name of names){const entered=numberValue(calcValues[name],NaN);if(Number.isFinite(entered))values[name]=entered}
   try{setCalcResult(valueText(evaluate(input||'0',{...evalOptions,variables:values})))}
   catch(error){setCalcResult(error instanceof Error?error.message:'Math ERROR')}
  }
  return <Panel title="CALC" close={closePanel}>
   <div className="casio-panel-note">Assign values, then evaluate the current expression.</div>
   <div className="casio-field-grid">
    {names.map(name=><Field key={name} label={name} value={calcValues[name]??String(variables[name]??0)} onChange={value=>setCalcValues(previous=>({...previous,[name]:value}))}/>)}
   </div>
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={run}>EVALUATE</button></div>
   {calcResult&&<div className="casio-panel-result">{calcResult}</div>}
  </Panel>;
 }

 function renderSolvePanel(){
  function run(){
   try{
    const expression=input.trim()||'0';
    const target=expression.includes('=')
     ?(x:number)=>{const [left,right]=expression.split('=');return realPart(evaluate(`(${left})-(${right})`,{...evalOptions,variables:{...variables,X:x}}))}
     :(x:number)=>realPart(evaluate(expression,{...evalOptions,variables:{...variables,X:x}}));
    const root=solveEquation(target,numberValue(solveGuess,0));
    if(root===null){setSolveResult('No root found');return}
    setVariables(previous=>({...previous,X:root}));
    setSolveResult(`X = ${numText(root)}`);
   }catch(error){setSolveResult(error instanceof Error?error.message:'Math ERROR')}
  }
  return <Panel title="SOLVE" close={closePanel}>
   <div className="casio-panel-note">Uses the current expression (use X). An equation with “=” is also accepted.</div>
   <Field label="Initial guess" value={solveGuess} onChange={setSolveGuess}/>
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={run}>SOLVE</button></div>
   {solveResult&&<div className="casio-panel-result">{solveResult}</div>}
  </Panel>;
 }

 function renderIntegralPanel(){
  function run(){
   try{
    const target=(x:number)=>realPart(evaluate(input||'0',{...evalOptions,variables:{...variables,X:x}}));
    const value=numericIntegral(target,numberValue(integralLower,0),numberValue(integralUpper,1));
    setIntegralResult(numText(value));
   }catch(error){setIntegralResult(error instanceof Error?error.message:'Math ERROR')}
  }
  return <Panel title="∫dx" close={closePanel}>
   <div className="casio-panel-note">Integrates the current expression over X.</div>
   <div className="casio-field-grid">
    <Field label="Lower" value={integralLower} onChange={setIntegralLower}/>
    <Field label="Upper" value={integralUpper} onChange={setIntegralUpper}/>
   </div>
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={run}>INTEGRATE</button></div>
   {integralResult&&<div className="casio-panel-result">{integralResult}</div>}
  </Panel>;
 }

 function renderDerivativePanel(){
  function run(){
   try{
    const target=(x:number)=>realPart(evaluate(input||'0',{...evalOptions,variables:{...variables,X:x}}));
    setDerivativeResult(numText(numericDerivative(target,numberValue(derivativePoint,0))));
   }catch(error){setDerivativeResult(error instanceof Error?error.message:'Math ERROR')}
  }
  return <Panel title="d/dx" close={closePanel}>
   <div className="casio-panel-note">Differentiates the current expression at a point.</div>
   <Field label="Point x" value={derivativePoint} onChange={setDerivativePoint}/>
   <div className="casio-panel-actions"><button type="button" className="primary" onClick={run}>DIFFERENTIATE</button></div>
   {derivativeResult&&<div className="casio-panel-result">{derivativeResult}</div>}
  </Panel>;
 }

 function renderModeMenu(){
  return <div className="casio-mode-menu">
   <div className="casio-mode-title">MODE</div>
   <div className="casio-mode-grid">
    {MODES.map(item=><button key={item.id} type="button" className={mode===item.id?'active':''} onClick={()=>chooseMode(item.id)}>
     <b>{item.label}</b><small>{item.hint}</small>
    </button>)}
   </div>
   <div className="casio-settings-row"><span>Angle</span>
    {(['DEG','RAD','GRA'] as const).map(unit=><button key={unit} type="button" className={angle===unit?'active':''} onClick={()=>setAngle(unit)}>{unit}</button>)}
   </div>
   <div className="casio-settings-row"><span>Display</span>
    {DISPLAY_PRESETS.map(preset=><button key={preset.label} type="button" className={display.kind===preset.value.kind&&display.digits===preset.value.digits?'active':''} onClick={()=>setDisplay(preset.value)}>{preset.label}</button>)}
   </div>
   <div className="casio-settings-row"><span>Result</span>
    <button type="button" className={fraction?'active':''} onClick={()=>setFraction(value=>!value)}>Fraction</button>
    <button type="button" className={improper?'active':''} onClick={()=>setImproper(value=>!value)}>d/c</button>
    <button type="button" className={sexagesimal?'active':''} onClick={()=>setSexagesimal(value=>!value)}>° ′ ″</button>
    <button type="button" className={engineering?'active':''} onClick={()=>setEngineering(value=>!value)}>ENG</button>
   </div>
   <div className="casio-mode-footer">
    <button type="button" onClick={hardReset}>RESET ALL</button>
    <button type="button" className="primary" onClick={()=>setModeMenu(false)}>CLOSE</button>
   </div>
  </div>;
 }

 const displayLabel=display.kind==='NORM'?`NORM${display.digits}`:display.kind==='FIX'?`FIX${display.digits}`:`SCI${display.digits}`;
 const statusFlags=[
  shift?'SHIFT':'',alpha?'ALPHA':'',hyp?'hyp':'',pending==='store'?'STO':'',pending==='recall'?'RCL':'',
  memory!==0?'M':'',engineering?'ENG':'',fraction?'FRAC':'',
 ].filter(Boolean);

 return <div ref={root} className="casio570" tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={event=>{
  if(!(event.target as HTMLElement).closest('input,select,textarea,button')){selectedField=null;replaceOnNextKey=false;root.current?.focus()}
 }}>
  <div className="casio-plate">
   <div className="casio-brand"><strong>CASIO</strong><span>fx-570E</span></div>
   <div className="casio-model">S-V.P.A.M.<small>NATURAL DISPLAY</small></div>
   <div className="casio-solar" aria-hidden="true"><i/><i/><i/><i/><i/></div>
  </div>
  <div className="casio-lcd">
   <div className="casio-lcd-status">
    <span>{mode}</span><span>{angle}</span><span>{displayLabel}</span>
    <span className="casio-lcd-flags">{statusFlags.join(' ')}</span>
   </div>
   <div ref={expressionLine} className="casio-lcd-expression">
    {input?<>{input.slice(0,cursor)}<span className="casio-cursor">▏</span>{input.slice(cursor)}</>:'0'}
   </div>
   <div className="casio-lcd-result">{message||result||preview||'\u00a0'}</div>
  </div>

  {modeMenu?renderModeMenu():<>
   {panel==='stat'&&renderStatPanel()}
   {panel==='eqn'&&renderEqnPanel()}
   {panel==='mat'&&renderMatPanel()}
   {panel==='vct'&&renderVctPanel()}
   {panel==='table'&&renderTablePanel()}
   {panel==='const'&&renderConstPanel()}
   {panel==='conv'&&renderConvPanel()}
   {panel==='calc'&&renderCalcPanel()}
   {panel==='solve'&&renderSolvePanel()}
   {panel==='integral'&&renderIntegralPanel()}
   {panel==='derivative'&&renderDerivativePanel()}

   <div className="casio-keypad">
    <div className="casio-topbar">
     <Key label="SHIFT" tone="shift" onPress={toggleShift}/>
     <Key label="ALPHA" tone="alpha" onPress={toggleAlpha}/>
     <div className="casio-replay" aria-label="Replay">
      <button type="button" className="r-up" onClick={historyPrevious} aria-label="Previous expression">▲</button>
      <button type="button" className="r-left" onClick={()=>setCursor(value=>Math.max(0,Math.min(input.length,value-1)))} aria-label="Cursor left">◀</button>
      <span className="r-center">REPLAY</span>
      <button type="button" className="r-right" onClick={()=>setCursor(value=>Math.min(input.length,value+1))} aria-label="Cursor right">▶</button>
      <button type="button" className="r-down" onClick={historyNext} aria-label="Next expression">▼</button>
     </div>
     <Key label="MODE" onPress={()=>{setModeMenu(true);clearMods();setPending(null)}}/>
     <Key label="ON" tone="on" onPress={()=>{clearMods();clearAll()}}/>
    </div>

    <div className="casio-function-grid">
     <Key label="CALC" shiftLabel="SOLVE" onPress={()=>{clearMods();setPanel('calc')}}/>
     <Key label="∫dx" shiftLabel="d/dx" onPress={()=>{const shifted=shift;clearMods();setPanel(shifted?'derivative':'integral')}}/>
     <Key label="x⁻¹" onPress={()=>{clearMods();insert('⁻¹')}}/>
     <Key label="log" shiftLabel="10^" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'10^(':'log(')}}/>
     <Key label="ln" shiftLabel="e^" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'exp(':'ln(')}}/>
     <Key label="x!" onPress={()=>{clearMods();insert('!')}}/>

     <Key label="a b/c" shiftLabel="d/c" onPress={()=>{const shifted=shift;clearMods();if(shifted)setImproper(value=>!value);else insert('⁄')}}/>
     <Key label="√" shiftLabel="∛" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'cbrt(':'sqrt(')}}/>
     <Key label="x²" shiftLabel="x³" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'³':'²')}}/>
     <Key label="x^" shiftLabel="ˣ√" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'root(':'^')}}/>
     <Key label="(-)" onPress={()=>{clearMods();insert('-')}}/>
     <Key label="°′″" onPress={()=>{clearMods();sexagesimalMark()}}/>

     <Key label="hyp" tone={hyp?'active':''} onPress={()=>{setHyp(value=>!value);setShift(false);setAlpha(false)}}/>
     <Key label="sin" shiftLabel="sinh" onPress={()=>trig('sin',false,shift||hyp)}/>
     <Key label="cos" shiftLabel="cosh" onPress={()=>trig('cos',false,shift||hyp)}/>
     <Key label="tan" shiftLabel="tanh" onPress={()=>trig('tan',false,shift||hyp)}/>
     <Key label="sin⁻¹" shiftLabel="asinh" onPress={()=>trig('sin',true,shift||hyp)}/>
     <Key label="cos⁻¹" shiftLabel="acosh" onPress={()=>trig('cos',true,shift||hyp)}/>

     <Key label="RCL" shiftLabel="STO" onPress={()=>{const shifted=shift;clearMods();setPending(shifted?'store':'recall');setMessage(shifted?'STO':'RCL')}}/>
     <Key label="STO" shiftLabel="RCL" onPress={()=>{const shifted=shift;clearMods();setPending(shifted?'recall':'store');setMessage(shifted?'RCL':'STO')}}/>
     <Key label="ENG" shiftLabel="←" onPress={()=>{const shifted=shift;clearMods();shifted?backspace():setEngineering(value=>!value)}}/>
     <Key label="(" shiftLabel="Abs" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'abs(':'(')}}/>
     <Key label=")" shiftLabel="%" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'%':')')}}/>
     <Key label="tan⁻¹" shiftLabel="atanh" onPress={()=>trig('tan',true,shift||hyp)}/>

     <Key label="i" onPress={()=>{clearMods();setMode('CMPLX');insert('i')}}/>
     <Key label="Abs" onPress={()=>{clearMods();insert('abs(')}}/>
     <Key label="%" onPress={()=>{clearMods();insert('%')}}/>
     <Key label="S⇔D" onPress={()=>{clearMods();setFraction(value=>!value);setSexagesimal(false)}}/>
     <Key label="M+" shiftLabel="M−" onPress={()=>{const shifted=shift;clearMods();memoryAdd(shifted?-1:1)}}/>
     <Key label="CONST" onPress={()=>{clearMods();setMode('CONST');setPanel('const')}}/>

     <Key label="CONV" onPress={()=>{clearMods();setMode('CONV');setPanel('conv')}}/>
     <Key label="π" onPress={()=>{clearMods();insert('π')}}/>
     <Key label="e" onPress={()=>{clearMods();insert('e')}}/>
     <Key label="," onPress={()=>{clearMods();insert(',')}}/>
     <Key label="nPr" onPress={()=>{clearMods();insert('nPr(')}}/>
     <Key label="nCr" onPress={()=>{clearMods();insert('nCr(')}}/>
    </div>

    <div className="casio-number-grid">
     <Key label="7" alphaLabel="A" onPress={()=>{digit('7',{alpha});clearMods()}}/>
     <Key label="8" alphaLabel="B" onPress={()=>{digit('8',{alpha});clearMods()}}/>
     <Key label="9" alphaLabel="C" onPress={()=>{digit('9',{alpha});clearMods()}}/>
     <Key label="DEL" onPress={()=>{clearMods();if(!fieldBackspace())backspace()}}/>
     <Key label="AC" shiftLabel="OFF" tone="ac" onPress={()=>{const shifted=shift;clearMods();if(shifted){hardReset();return}if(!fieldClear())clearAll()}}/>

     <Key label="4" alphaLabel="D" onPress={()=>{digit('4',{alpha});clearMods()}}/>
     <Key label="5" alphaLabel="E" onPress={()=>{digit('5',{alpha});clearMods()}}/>
     <Key label="6" alphaLabel="F" onPress={()=>{digit('6',{alpha});clearMods()}}/>
     <Key label="×" onPress={()=>{clearMods();insert('×')}}/>
     <Key label="÷" onPress={()=>{clearMods();insert('÷')}}/>

     <Key label="1" alphaLabel="X" onPress={()=>{digit('1',{alpha});clearMods()}}/>
     <Key label="2" alphaLabel="Y" onPress={()=>{digit('2',{alpha});clearMods()}}/>
     <Key label="3" alphaLabel="M" onPress={()=>{digit('3',{alpha});clearMods()}}/>
     <Key label="+" shiftLabel="Pol" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'pol(':'+')}}/>
     <Key label="−" shiftLabel="Rec" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'rec(':'-')}}/>

     <Key label="0" shiftLabel="Rnd" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'rnd(':'0')}}/>
     <Key label="." shiftLabel="Ran#" onPress={()=>{const shifted=shift;clearMods();insert(shifted?'ran':'.')}}/>
     <Key label="EXP" onPress={()=>{clearMods();insert('E')}}/>
     <Key label="Ans" onPress={()=>{clearMods();insert('Ans')}}/>
     <Key label="=" tone="equals" onPress={()=>{clearMods();calculate()}}/>
    </div>
   </div>
  </>}
 </div>;
}
function variablesInLocal(expression:string):string[]{
 const found=new Set<string>();
 for(const match of expression.matchAll(/\b([A-FXY])\b/g))found.add(match[1]);
 return [...found];
}
