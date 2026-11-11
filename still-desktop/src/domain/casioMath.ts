// Casio fx-570E style math engine: expression parsing, complex numbers,
// statistics, equations, matrices, vectors, calculus and unit data.

export type AngleUnit='DEG'|'RAD'|'GRA';
export interface ComplexValue{re:number;im:number}
export type Num=number|ComplexValue;
export type DisplayMode={kind:'NORM';digits:1|2}|{kind:'FIX';digits:number}|{kind:'SCI';digits:number};

export interface EvalOptions{
 angle:AngleUnit;
 variables:Record<string,number>;
 memory:number;
 ans:Num;
 complex:boolean;
}

const DEFAULT_OPTIONS:EvalOptions={angle:'DEG',variables:{},memory:0,ans:0,complex:false};

export class CasioError extends Error{
 constructor(message:string){super(message);this.name='CasioError'}
}

const asComplex=(v:Num):ComplexValue=>typeof v==='number'?{re:v,im:0}:v;
const normalize=(z:ComplexValue):Num=>Math.abs(z.im)<1e-14?z.re:z;
const isComplex=(v:Num):v is ComplexValue=>typeof v!=='number';

function cadd(a:Num,b:Num):Num{
 if(typeof a==='number'&&typeof b==='number')return a+b;
 const x=asComplex(a),y=asComplex(b);return normalize({re:x.re+y.re,im:x.im+y.im});
}
function csub(a:Num,b:Num):Num{
 if(typeof a==='number'&&typeof b==='number')return a-b;
 const x=asComplex(a),y=asComplex(b);return normalize({re:x.re-y.re,im:x.im-y.im});
}
function cneg(a:Num):Num{return typeof a==='number'?-a:normalize({re:-a.re,im:-a.im})}
function cmul(a:Num,b:Num):Num{
 if(typeof a==='number'&&typeof b==='number')return a*b;
 const x=asComplex(a),y=asComplex(b);
 return normalize({re:x.re*y.re-x.im*y.im,im:x.re*y.im+x.im*y.re});
}
function cdiv(a:Num,b:Num):Num{
 if(typeof a==='number'&&typeof b==='number'){
  if(b===0)throw new CasioError('Math ERROR');
  return a/b;
 }
 const x=asComplex(a),y=asComplex(b),d=y.re*y.re+y.im*y.im;
 if(d===0)throw new CasioError('Math ERROR');
 return normalize({re:(x.re*y.re+x.im*y.im)/d,im:(x.im*y.re-x.re*y.im)/d});
}
function cabs(a:Num):number{return typeof a==='number'?Math.abs(a):Math.hypot(a.re,a.im)}
function cexp(a:Num):Num{
 if(typeof a==='number')return Math.exp(a);
 const r=Math.exp(a.re);return normalize({re:r*Math.cos(a.im),im:r*Math.sin(a.im)});
}
function cln(a:Num):Num{
 if(typeof a==='number'){
  if(a===0)throw new CasioError('Math ERROR');
  if(a<0)return {re:Math.log(-a),im:Math.PI};
  return Math.log(a);
 }
 if(a.re===0&&a.im===0)throw new CasioError('Math ERROR');
 return {re:Math.log(Math.hypot(a.re,a.im)),im:Math.atan2(a.im,a.re)};
}
function csqrt(a:Num):Num{
 if(typeof a==='number')return a>=0?Math.sqrt(a):{re:0,im:Math.sqrt(-a)};
 const r=Math.hypot(a.re,a.im);
 const re=Math.sqrt((r+a.re)/2);
 const im=(a.im<0?-1:1)*Math.sqrt(Math.max(0,(r-a.re)/2));
 return normalize({re,im});
}
function cpow(base:Num,exponent:Num):Num{
 const e=asComplex(exponent);
 if(Math.abs(e.im)<1e-14&&Number.isInteger(e.re)&&Math.abs(e.re)<=1024){
  const n=e.re;
  if(n===0)return 1;
  let result:Num=1,factor:Num=base,k=Math.abs(n);
  while(k>0){if(k&1)result=cmul(result,factor);factor=cmul(factor,factor);k>>=1}
  return n<0?cdiv(1,result):result;
 }
 if(typeof base==='number'&&base===0){
  if(e.re>0)return 0;
  throw new CasioError('Math ERROR');
 }
 return cexp(cmul(exponent,cln(base)));
}

function factorial(value:Num):number{
 if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>170)throw new CasioError('Math ERROR');
 let result=1;for(let i=2;i<=value;i++)result*=i;return result;
}
function permutations(n:number,r:number):number{
 if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)throw new CasioError('Math ERROR');
 let result=1;for(let i=0;i<r;i++)result*=n-i;return result;
}
function combinations(n:number,r:number):number{
 if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)throw new CasioError('Math ERROR');
 r=Math.min(r,n-r);let result=1;for(let i=1;i<=r;i++)result=result*(n-r+i)/i;return Math.round(result);
}
function gcd(a:number,b:number):number{a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b){const t=a%b;a=b;b=t}return a}
function lcm(a:number,b:number):number{const g=gcd(a,b);return g?a/g*b:0}

function toRadians(value:number,unit:AngleUnit):number{
 return unit==='DEG'?value*Math.PI/180:unit==='GRA'?value*Math.PI/200:value;
}
function fromRadians(value:number,unit:AngleUnit):number{
 return unit==='DEG'?value*180/Math.PI:unit==='GRA'?value*200/Math.PI:value;
}
function realOnly(value:Num):number{
 if(typeof value!=='number')throw new CasioError('Math ERROR');
 return value;
}

function callFunction(rawName:string,args:Num[],opts:EvalOptions):Num{
 const name=rawName.toLowerCase();
 const arg=(index:number):Num=>{if(index>=args.length)throw new CasioError('Syntax ERROR');return args[index]};
 switch(name){
  case 'sin':return Math.sin(toRadians(realOnly(arg(0)),opts.angle));
  case 'cos':return Math.cos(toRadians(realOnly(arg(0)),opts.angle));
  case 'tan':{
   const radians=toRadians(realOnly(arg(0)),opts.angle);
   const cosine=Math.cos(radians);
   if(Math.abs(cosine)<1e-14)throw new CasioError('Math ERROR');
   return Math.sin(radians)/cosine;
  }
  case 'asin':return fromRadians(Math.asin(realOnly(arg(0))),opts.angle);
  case 'acos':return fromRadians(Math.acos(realOnly(arg(0))),opts.angle);
  case 'atan':return fromRadians(Math.atan(realOnly(arg(0))),opts.angle);
  case 'sinh':return Math.sinh(realOnly(arg(0)));
  case 'cosh':return Math.cosh(realOnly(arg(0)));
  case 'tanh':return Math.tanh(realOnly(arg(0)));
  case 'asinh':return Math.asinh(realOnly(arg(0)));
  case 'acosh':return Math.acosh(realOnly(arg(0)));
  case 'atanh':return Math.atanh(realOnly(arg(0)));
  case 'log':{
   if(args.length===1)return Math.log10(realOnly(arg(0)));
   if(args.length===2)return Math.log(realOnly(arg(1)))/Math.log(realOnly(arg(0)));
   throw new CasioError('Syntax ERROR');
  }
  case 'ln':return cln(arg(0));
  case 'exp':return cexp(arg(0));
  case 'sqrt':return csqrt(arg(0));
  case 'cbrt':{
   const value=arg(0);
   if(typeof value==='number')return Math.cbrt(value);
   return cpow(value,1/3);
  }
  case 'root':{
   const index=realOnly(arg(0)),value=arg(1);
   if(index===0)throw new CasioError('Math ERROR');
   if(typeof value==='number'&&value<0&&Number.isInteger(index)&&Math.abs(index)%2===1)return -Math.pow(-value,1/index);
   return cpow(value,1/index);
  }
  case 'abs':return cabs(arg(0));
  case 'arg':{
   const value=asComplex(arg(0));return Math.atan2(value.im,value.re);
  }
  case 'conj':{
   const value=asComplex(arg(0));return normalize({re:value.re,im:-value.im});
  }
  case 're':return asComplex(arg(0)).re;
  case 'im':return asComplex(arg(0)).im;
  case 'round':{
   const value=realOnly(arg(0)),digits=args.length>1?realOnly(arg(1)):0;
   const factor=10**Math.trunc(digits);return Math.round(value*factor)/factor;
  }
  case 'int':return Math.trunc(realOnly(arg(0)));
  case 'frac':{
   const value=realOnly(arg(0));return value-Math.trunc(value);
  }
  case 'sign':{
   const value=realOnly(arg(0));return Math.sign(value);
  }
  case 'npr':return permutations(realOnly(arg(0)),realOnly(arg(1)));
  case 'ncr':return combinations(realOnly(arg(0)),realOnly(arg(1)));
  case 'gcd':return gcd(realOnly(arg(0)),realOnly(arg(1)));
  case 'lcm':return lcm(realOnly(arg(0)),realOnly(arg(1)));
  case 'min':return Math.min(...args.map(realOnly));
  case 'max':return Math.max(...args.map(realOnly));
  case 'ran':return Math.random();
  case 'ranint':{
   const low=Math.ceil(realOnly(arg(0))),high=Math.floor(realOnly(arg(1)));
   return low+Math.floor(Math.random()*(high-low+1));
  }
  case 'rnd':{
   const value=realOnly(arg(0));return Number(value.toPrecision(10));
  }
  case 'pol':return Math.hypot(realOnly(arg(0)),realOnly(arg(1)));
  case 'rec':{
   const radius=realOnly(arg(0)),theta=toRadians(realOnly(arg(1)),opts.angle);return radius*Math.cos(theta);
  }
  default:throw new CasioError('Syntax ERROR');
 }
}

interface Token{kind:'num'|'id'|'op'|'('|')'|',';text:string;value?:number}

function tokenize(text:string):Token[]{
 const tokens:Token[]=[];let index=0;
 while(index<text.length){
  const char=text[index];
  if(/\s/.test(char)){index++;continue}
  if(/[0-9.]/.test(char)){
   const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/.exec(text.slice(index));
   if(!match)throw new CasioError('Syntax ERROR');
   const raw=match[0],value=Number(raw);
   if(!Number.isFinite(value))throw new CasioError('Syntax ERROR');
   tokens.push({kind:'num',text:raw,value});index+=raw.length;continue;
  }
  if(/[A-Za-z]/.test(char)){
   const match=/^[A-Za-z]+/.exec(text.slice(index));
   if(!match)throw new CasioError('Syntax ERROR');
   tokens.push({kind:'id',text:match[0]});index+=match[0].length;continue;
  }
  if('+-*/^!%'.includes(char)){tokens.push({kind:'op',text:char});index++;continue}
  if(char==='('){tokens.push({kind:'(',text:char});index++;continue}
  if(char===')'){tokens.push({kind:')',text:char});index++;continue}
  if(char===','){tokens.push({kind:',',text:char});index++;continue}
  throw new CasioError('Syntax ERROR');
 }
 return tokens;
}

class Parser{
 private position=0;
 constructor(private tokens:Token[],private opts:EvalOptions){}
 parse():Num{
  if(!this.tokens.length)throw new CasioError('Syntax ERROR');
  const value=this.expression();
  if(this.position<this.tokens.length)throw new CasioError('Syntax ERROR');
  return value;
 }
 private peek():Token|undefined{return this.tokens[this.position]}
 private next():Token|undefined{return this.tokens[this.position++]}
 private matchOperator(...operators:string[]):boolean{
  const token=this.peek();
  if(token?.kind==='op'&&operators.includes(token.text)){this.position++;return true}
  return false;
 }
 private expect(kind:')'|','):void{
  const token=this.next();
  if(!token||token.kind!==kind)throw new CasioError('Syntax ERROR');
 }
 private expression():Num{
  let value=this.term();
  while(true){
   if(this.matchOperator('+'))value=cadd(value,this.term());
   else if(this.matchOperator('-'))value=csub(value,this.term());
   else break;
  }
  return value;
 }
 private startsPrimary(token:Token|undefined):boolean{
  return !!token&&(token.kind==='num'||token.kind==='id'||token.kind==='(');
 }
 private term():Num{
  let value=this.unary();
  while(true){
   if(this.matchOperator('*'))value=cmul(value,this.unary());
   else if(this.matchOperator('/'))value=cdiv(value,this.unary());
   else if(this.startsPrimary(this.peek()))value=cmul(value,this.unary());
   else break;
  }
  return value;
 }
 private unary():Num{
  if(this.matchOperator('-'))return cneg(this.unary());
  if(this.matchOperator('+'))return this.unary();
  return this.power();
 }
 private power():Num{
  const base=this.postfix();
  if(this.matchOperator('^'))return cpow(base,this.unary());
  return base;
 }
 private postfix():Num{
  let value=this.primary();
  while(true){
   if(this.matchOperator('!'))value=factorial(value);
   else if(this.matchOperator('%'))value=cdiv(value,100);
   else break;
  }
  return value;
 }
 private primary():Num{
  const token=this.next();
  if(!token)throw new CasioError('Syntax ERROR');
  if(token.kind==='num')return token.value!;
  if(token.kind==='('){
   const value=this.expression();this.expect(')');return value;
  }
  if(token.kind==='id'){
   const name=token.text;
   if(this.peek()?.kind==='('){
    this.position++;
    const args:Num[]=[];
    if(this.peek()?.kind!==')'){
     args.push(this.expression());
     while(this.peek()?.kind===','){this.position++;args.push(this.expression())}
    }
    this.expect(')');
    return callFunction(name,args,this.opts);
   }
   return resolveIdentifier(name,this.opts);
  }
  throw new CasioError('Syntax ERROR');
 }
}

function resolveIdentifier(name:string,opts:EvalOptions):Num{
 const upper=name.toUpperCase();
 if(upper==='ANS')return opts.ans;
 if(upper==='PI')return Math.PI;
 if(name==='e')return Math.E;
 if(name==='i'){
  if(!opts.complex)throw new CasioError('Syntax ERROR');
  return {re:0,im:1};
 }
 if(upper==='M')return opts.memory;
 if(upper==='RAN')return Math.random();
 if(/^[A-FXY]$/.test(upper))return opts.variables[upper]??0;
 throw new CasioError('Syntax ERROR');
}

function preprocess(raw:string):string{
 let text=raw.trim();
 if(!text)throw new CasioError('Syntax ERROR');
 text=text
  .replace(/×/g,'*')
  .replace(/÷/g,'/')
  .replace(/[−–—]/g,'-')
  .replace(/⁻¹/g,'^(-1)')
  .replace(/²/g,'^2')
  .replace(/³/g,'^3')
  .replace(/ˣ√/g,'root')
  .replace(/√/g,'sqrt')
  .replace(/∛/g,'cbrt')
  .replace(/π/g,'pi')
  .replace(/Ran#/gi,'ran');
 text=text.replace(/(\d+(?:\.\d+)?)°(?:(\d+(?:\.\d+)?)′)?(?:(\d+(?:\.\d+)?)″)?/g,
  (_match,degrees:string,minutes?:string,seconds?:string)=>
   `(${Number(degrees)}+${Number(minutes??0)}/60+${Number(seconds??0)}/3600)`);
 text=text.replace(/[°′″]/g,'');
 text=text.replace(/(\d+)\s+(\d+)⁄(\d+)/g,(_m,whole:string,numerator:string,denominator:string)=>`(${whole}+${numerator}/${denominator})`);
 text=text.replace(/(\d+)⁄(\d+)/g,(_m,numerator:string,denominator:string)=>`(${numerator}/${denominator})`);
 text=text.replace(/⁄/g,'/');
 return text;
}

export function evaluate(expression:string,options?:Partial<EvalOptions>):Num{
 const opts:EvalOptions={...DEFAULT_OPTIONS,...options,variables:{...DEFAULT_OPTIONS.variables,...options?.variables}};
 const tokens=tokenize(preprocess(expression));
 const value=new Parser(tokens,opts).parse();
 if(!opts.complex&&isComplex(value))throw new CasioError('Math ERROR');
 return value;
}

const SUPERSCRIPTS='⁰¹²³⁴⁵⁶⁷⁸⁹';
function superscript(value:number):string{
 return String(value).split('').map(char=>char==='-'?'⁻':SUPERSCRIPTS[Number(char)]??char).join('');
}
function trimNumber(value:string):string{
 if(!value.includes('.'))return value;
 return value.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
function plainNumber(value:number):string{
 let text=value.toPrecision(10);
 if(text.includes('e')){
  const [mantissa,exponent]=text.split('e');
  return `${trimNumber(mantissa)}×10${superscript(Number(exponent))}`;
 }
 return trimNumber(text);
}

export function formatNumber(value:number,display:DisplayMode,engineering=false):string{
 if(!Number.isFinite(value))throw new CasioError('Math ERROR');
 if(Object.is(value,-0))value=0;
 if(value===0){
  if(display.kind==='SCI')return `0.${'0'.repeat(Math.max(0,display.digits))}×10⁰`;
  if(display.kind==='FIX')return (0).toFixed(display.digits);
  return '0';
 }
 if(display.kind==='FIX')return value.toFixed(display.digits);
 if(display.kind==='SCI'){
  const exponent=Math.floor(Math.log10(Math.abs(value)));
  const mantissa=value/10**exponent;
  return `${mantissa.toFixed(display.digits)}×10${superscript(exponent)}`;
 }
 const absolute=Math.abs(value);
 if(engineering){
  const exponent=Math.floor(Math.log10(absolute)/3)*3;
  const mantissa=value/10**exponent;
  return `${trimNumber(mantissa.toPrecision(10))}×10${superscript(exponent)}`;
 }
 const threshold=display.digits===1?1e-2:1e-9;
 if(absolute>=1e10||absolute<threshold){
  const exponent=Math.floor(Math.log10(absolute));
  const mantissa=value/10**exponent;
  return `${trimNumber(mantissa.toPrecision(10))}×10${superscript(exponent)}`;
 }
 return plainNumber(value);
}

export interface Fraction{n:number;d:number}
export function toFraction(value:number,maxDenominator=10000):Fraction|null{
 if(!Number.isFinite(value)||Math.abs(value)>1e12)return null;
 const sign=value<0?-1:1;
 let x=Math.abs(value);
 let previousNumerator=0,numerator=1,previousDenominator=1,denominator=0,remainder=x;
 for(let guard=0;guard<64;guard++){
  const whole=Math.floor(remainder);
  const nextNumerator=whole*numerator+previousNumerator;
  const nextDenominator=whole*denominator+previousDenominator;
  if(nextDenominator>maxDenominator)return null;
  if(Math.abs(x-nextNumerator/nextDenominator)<1e-10)return {n:sign*nextNumerator,d:nextDenominator};
  previousNumerator=numerator;numerator=nextNumerator;
  previousDenominator=denominator;denominator=nextDenominator;
  const fraction=remainder-whole;
  if(fraction<1e-14)return null;
  remainder=1/fraction;
  if(!Number.isFinite(remainder))return null;
 }
 return null;
}

export function formatFraction(value:Fraction,improper=false):string{
 const sign=value.n<0?'-':'';
 const absolute=Math.abs(value.n);
 if(absolute%value.d===0)return `${sign}${absolute/value.d}`;
 if(improper)return `${sign}${absolute}/${value.d}`;
 const whole=Math.floor(absolute/value.d);
 return whole?`${sign}${whole} ${absolute%value.d}/${value.d}`:`${sign}${absolute}/${value.d}`;
}

export function toSexagesimal(value:number):string{
 const sign=value<0?'-':'';
 let x=Math.abs(value);
 let degrees=Math.floor(x);
 let minutesFloat=(x-degrees)*60;
 let minutes=Math.floor(minutesFloat);
 let seconds=Math.round((minutesFloat-minutes)*60);
 if(seconds>=60){seconds-=60;minutes++}
 if(minutes>=60){minutes-=60;degrees++}
 return `${sign}${degrees}°${minutes}′${seconds}″`;
}

export function fromSexagesimal(degrees:number,minutes:number,seconds:number):number{
 return Math.sign(degrees||1)*(Math.abs(degrees)+Math.abs(minutes)/60+Math.abs(seconds)/3600);
}

export interface FormatOptions{
 display:DisplayMode;
 fraction?:boolean;
 improper?:boolean;
 sexagesimal?:boolean;
 engineering?:boolean;
}
export function formatValue(value:Num,options:FormatOptions):string{
 const base={display:options.display,engineering:options.engineering};
 if(isComplex(value)){
  const real=value.re,imaginary=value.im;
  if(Math.abs(imaginary)<1e-12)return formatNumber(real,options.display,options.engineering);
  const realPart=Math.abs(real)<1e-12?'':formatNumber(real,options.display,options.engineering);
  const sign=imaginary<0?'-':'+';
  const magnitude=Math.abs(imaginary);
  const imaginaryPart=Math.abs(magnitude-1)<1e-12?'i':`${formatNumber(magnitude,options.display,options.engineering)}i`;
  return realPart?`${realPart}${sign}${imaginaryPart}`:`${imaginary<0?'-':''}${imaginaryPart}`;
 }
 if(options.sexagesimal)return toSexagesimal(value);
 if(options.fraction){
  const fraction=toFraction(value);
  if(fraction)return formatFraction(fraction,options.improper);
 }
 return formatNumber(value,base.display,base.engineering);
}

export function variablesIn(expression:string):string[]{
 const found=new Set<string>();
 for(const match of expression.matchAll(/\b([A-FXY])\b/g))found.add(match[1]);
 return [...found].sort();
}

export interface StatRow{x:number;y?:number;freq?:number}
export interface Stat1Result{
 n:number;sum:number;sum2:number;mean:number;sampleSd:number;populationSd:number;
 min:number;q1:number;median:number;q3:number;max:number;
}
function median(values:number[]):number{
 if(!values.length)return NaN;
 const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
export function stat1(rows:StatRow[]):Stat1Result|null{
 const expanded:number[]=[];
 let n=0,sum=0,sum2=0;
 for(const row of rows){
  if(!Number.isFinite(row.x))continue;
  const frequency=row.freq&&row.freq>0?Math.round(row.freq):1;
  n+=frequency;sum+=row.x*frequency;sum2+=row.x*row.x*frequency;
  for(let i=0;i<Math.min(frequency,20000);i++)expanded.push(row.x);
 }
 if(!n)return null;
 const mean=sum/n;
 const variance=Math.max(0,sum2/n-mean*mean);
 const sorted=[...expanded].sort((a,b)=>a-b);
 const middle=Math.floor(sorted.length/2);
 const lower=sorted.slice(0,sorted.length%2?middle:middle);
 const upper=sorted.slice(sorted.length%2?middle+1:middle);
 return{
  n,sum,sum2,mean,
  sampleSd:Math.sqrt(Math.max(0,(sum2-n*mean*mean)/(n-1))),
  populationSd:Math.sqrt(variance),
  min:sorted[0],max:sorted[sorted.length-1],
  q1:median(lower),median:median(sorted),q3:median(upper),
 };
}
export interface Stat2Result{
 n:number;sumX:number;sumY:number;sumX2:number;sumY2:number;sumXY:number;
 meanX:number;meanY:number;sampleSdX:number;sampleSdY:number;populationSdX:number;populationSdY:number;
 r:number;a:number;b:number;
}
export function stat2(rows:StatRow[]):Stat2Result|null{
 let n=0,sumX=0,sumY=0,sumX2=0,sumY2=0,sumXY=0;
 for(const row of rows){
  if(!Number.isFinite(row.x)||!Number.isFinite(row.y))continue;
  const frequency=row.freq&&row.freq>0?Math.round(row.freq):1;
  n+=frequency;sumX+=row.x*frequency;sumY+=row.y!*frequency;
  sumX2+=row.x*row.x*frequency;sumY2+=row.y!*row.y!*frequency;sumXY+=row.x*row.y!*frequency;
 }
 if(!n)return null;
 const meanX=sumX/n,meanY=sumY/n;
 const varianceX=Math.max(0,sumX2/n-meanX*meanX),varianceY=Math.max(0,sumY2/n-meanY*meanY);
 const covariance=sumXY/n-meanX*meanY;
 const denominator=sumX2-n*meanX*meanX;
 const b=denominator?covariance*n/denominator:0;
 return{
  n,sumX,sumY,sumX2,sumY2,sumXY,meanX,meanY,
  sampleSdX:Math.sqrt(Math.max(0,(sumX2-n*meanX*meanX)/(n-1))),
  sampleSdY:Math.sqrt(Math.max(0,(sumY2-n*meanY*meanY)/(n-1))),
  populationSdX:Math.sqrt(varianceX),populationSdY:Math.sqrt(varianceY),
  r:varianceX&&varianceY?covariance/Math.sqrt(varianceX*varianceY):0,
  a:meanY-b*meanX,b,
 };
}

export function solveLinear2(a1:number,b1:number,c1:number,a2:number,b2:number,c2:number):[number,number]|null{
 const determinant=a1*b2-a2*b1;
 if(Math.abs(determinant)<1e-14)return null;
 return[(c1*b2-c2*b1)/determinant,(a1*c2-a2*c1)/determinant];
}
function determinant3(m:number[][]):number{
 return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
  -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
  +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
}
export function solveLinear3(rows:number[][]):[number,number,number]|null{
 const determinant=determinant3(rows.map(row=>row.slice(0,3)));
 if(Math.abs(determinant)<1e-14)return null;
 const replace=(column:number)=>rows.map((row,index)=>row.map((value,position)=>position===column?row[3]:value));
 return[
  determinant3(replace(0))/determinant,
  determinant3(replace(1))/determinant,
  determinant3(replace(2))/determinant,
 ];
}
export function solveQuadratic(a:number,b:number,c:number):Num[]{
 if(Math.abs(a)<1e-14){
  if(Math.abs(b)<1e-14)return[];
  return[-c/b];
 }
 const discriminant=b*b-4*a*c;
 if(discriminant>=0){
  const root=Math.sqrt(discriminant);
  return[(-b+root)/(2*a),(-b-root)/(2*a)].sort((x,y)=>x-y);
 }
 const root=Math.sqrt(-discriminant);
 return[{re:-b/(2*a),im:root/(2*a)},{re:-b/(2*a),im:-root/(2*a)}];
}
export function solveCubic(a:number,b:number,c:number,d:number):Num[]{
 if(Math.abs(a)<1e-14)return solveQuadratic(b,c,d);
 const p=(3*a*c-b*b)/(3*a*a);
 const q=(2*b*b*b-9*a*b*c+27*a*a*d)/(27*a*a*a);
 const offset=b/(3*a);
 const discriminant=(q/2)**2+(p/3)**3;
 if(discriminant>1e-12){
  const root=Math.sqrt(discriminant);
  const u=Math.cbrt(-q/2+root),v=Math.cbrt(-q/2-root);
  const real=u+v-offset;
  const realPart=-(u+v)/2-offset;
  const imaginaryPart=(u-v)*Math.sqrt(3)/2;
  return[real,{re:realPart,im:imaginaryPart},{re:realPart,im:-imaginaryPart}];
 }
 if(Math.abs(p)<1e-14&&Math.abs(q)<1e-14)return[-offset];
 const radius=Math.sqrt(Math.max(0,-(p**3)/27));
 const ratio=radius?Math.max(-1,Math.min(1,-q/(2*radius))):0;
 const phi=Math.acos(ratio);
 const scale=2*Math.cbrt(radius);
 return[
  scale*Math.cos(phi/3)-offset,
  scale*Math.cos((phi+2*Math.PI)/3)-offset,
  scale*Math.cos((phi+4*Math.PI)/3)-offset,
 ].sort((x,y)=>x-y);
}

export type Matrix=number[][];
export function matrixAdd(a:Matrix,b:Matrix):Matrix{
 if(a.length!==b.length||a[0]?.length!==b[0]?.length)throw new CasioError('Dimension ERROR');
 return a.map((row,index)=>row.map((value,column)=>value+b[index][column]));
}
export function matrixSub(a:Matrix,b:Matrix):Matrix{
 if(a.length!==b.length||a[0]?.length!==b[0]?.length)throw new CasioError('Dimension ERROR');
 return a.map((row,index)=>row.map((value,column)=>value-b[index][column]));
}
export function matrixMul(a:Matrix,b:Matrix):Matrix{
 if(a[0]?.length!==b.length)throw new CasioError('Dimension ERROR');
 return a.map(row=>b[0].map((_value,column)=>row.reduce((sum,value,index)=>sum+value*b[index][column],0)));
}
export function matrixTranspose(a:Matrix):Matrix{
 return a[0].map((_value,column)=>a.map(row=>row[column]));
}
export function matrixDet(a:Matrix):number{
 const size=a.length;
 if(!size||a.some(row=>row.length!==size))throw new CasioError('Dimension ERROR');
 if(size===1)return a[0][0];
 if(size===2)return a[0][0]*a[1][1]-a[0][1]*a[1][0];
 if(size===3)return determinant3(a);
 const clone=a.map(row=>row.slice());
 let determinant=1;
 for(let column=0;column<size;column++){
  let pivot=column;
  for(let row=column+1;row<size;row++)if(Math.abs(clone[row][column])>Math.abs(clone[pivot][column]))pivot=row;
  if(Math.abs(clone[pivot][column])<1e-14)return 0;
  if(pivot!==column){[clone[pivot],clone[column]]=[clone[column],clone[pivot]];determinant*=-1}
  determinant*=clone[column][column];
  for(let row=column+1;row<size;row++){
   const factor=clone[row][column]/clone[column][column];
   for(let k=column;k<size;k++)clone[row][k]-=factor*clone[column][k];
  }
 }
 return determinant;
}
export function matrixInverse(a:Matrix):Matrix{
 const size=a.length;
 if(!size||a.some(row=>row.length!==size))throw new CasioError('Dimension ERROR');
 const augmented=a.map((row,index)=>[...row,...Array.from({length:size},(_v,column)=>column===index?1:0)]);
 for(let column=0;column<size;column++){
  let pivot=column;
  for(let row=column+1;row<size;row++)if(Math.abs(augmented[row][column])>Math.abs(augmented[pivot][column]))pivot=row;
  if(Math.abs(augmented[pivot][column])<1e-14)throw new CasioError('Math ERROR');
  [augmented[pivot],augmented[column]]=[augmented[column],augmented[pivot]];
  const divisor=augmented[column][column];
  for(let k=0;k<2*size;k++)augmented[column][k]/=divisor;
  for(let row=0;row<size;row++){
   if(row===column)continue;
   const factor=augmented[row][column];
   if(!factor)continue;
   for(let k=0;k<2*size;k++)augmented[row][k]-=factor*augmented[column][k];
  }
 }
 return augmented.map(row=>row.slice(size).map(value=>Math.abs(value)<1e-12?0:value));
}
export function matrixIdentity(size:number):Matrix{
 return Array.from({length:size},(_v,row)=>Array.from({length:size},(_w,column)=>row===column?1:0));
}

export function vectorAdd(a:number[],b:number[]):number[]{
 if(a.length!==b.length)throw new CasioError('Dimension ERROR');
 return a.map((value,index)=>value+b[index]);
}
export function vectorSub(a:number[],b:number[]):number[]{
 if(a.length!==b.length)throw new CasioError('Dimension ERROR');
 return a.map((value,index)=>value-b[index]);
}
export function vectorDot(a:number[],b:number[]):number{
 if(a.length!==b.length)throw new CasioError('Dimension ERROR');
 return a.reduce((sum,value,index)=>sum+value*b[index],0);
}
export function vectorCross(a:number[],b:number[]):number[]{
 if(a.length!==3||b.length!==3)throw new CasioError('Dimension ERROR');
 return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
}
export function vectorNorm(a:number[]):number{return Math.hypot(...a)}
export function vectorUnit(a:number[]):number[]{
 const norm=vectorNorm(a);if(!norm)throw new CasioError('Math ERROR');
 return a.map(value=>value/norm);
}

export function numericDerivative(f:(x:number)=>number,x:number):number{
 const step=1e-6*Math.max(1,Math.abs(x));
 return (f(x+step)-f(x-step))/(2*step);
}
export function numericIntegral(f:(x:number)=>number,a:number,b:number,intervals=1000):number{
 let n=Math.max(2,Math.round(intervals));if(n%2)n++;
 const step=(b-a)/n;let sum=f(a)+f(b);
 for(let index=1;index<n;index++)sum+=f(a+index*step)*(index%2?4:2);
 return sum*step/3;
}
export function solveEquation(f:(x:number)=>number,guess=0):number|null{
 let x=guess;
 for(let iteration=0;iteration<80;iteration++){
  const value=f(x);
  if(!Number.isFinite(value))break;
  if(Math.abs(value)<1e-12)return x;
  const step=1e-6*Math.max(1,Math.abs(x));
  const derivative=(f(x+step)-f(x-step))/(2*step);
  if(!Number.isFinite(derivative)||Math.abs(derivative)<1e-14)break;
  const next=x-value/derivative;
  if(!Number.isFinite(next))break;
  if(Math.abs(next-x)<1e-12)return next;
  x=next;
 }
 let previousX=-100,previousValue=f(previousX);
 for(let index=1;index<=4000;index++){
  const currentX=-100+index*0.05;
  const currentValue=f(currentX);
  if(Number.isFinite(currentValue)&&Number.isFinite(previousValue)&&currentValue*previousValue<=0){
   let low=previousX,high=currentX,lowValue=previousValue;
   for(let iteration=0;iteration<100;iteration++){
    const middle=(low+high)/2,middleValue=f(middle);
    if(middleValue*lowValue<=0)high=middle;
    else{low=middle;lowValue=middleValue}
   }
   return (low+high)/2;
  }
  previousX=currentX;previousValue=currentValue;
 }
 return null;
}

export interface PhysicalConstant{symbol:string;name:string;value:number;unit:string}
export const physicalConstants:PhysicalConstant[]=[
 {symbol:'c',name:'Speed of light',value:299792458,unit:'m/s'},
 {symbol:'h',name:'Planck constant',value:6.62607015e-34,unit:'J·s'},
 {symbol:'ħ',name:'Reduced Planck constant',value:1.054571817e-34,unit:'J·s'},
 {symbol:'e',name:'Elementary charge',value:1.602176634e-19,unit:'C'},
 {symbol:'mₑ',name:'Electron mass',value:9.1093837015e-31,unit:'kg'},
 {symbol:'mₚ',name:'Proton mass',value:1.67262192369e-27,unit:'kg'},
 {symbol:'mₙ',name:'Neutron mass',value:1.67492749804e-27,unit:'kg'},
 {symbol:'Nₐ',name:'Avogadro constant',value:6.02214076e23,unit:'mol⁻¹'},
 {symbol:'k',name:'Boltzmann constant',value:1.380649e-23,unit:'J/K'},
 {symbol:'R',name:'Molar gas constant',value:8.314462618,unit:'J/(mol·K)'},
 {symbol:'G',name:'Gravitational constant',value:6.67430e-11,unit:'m³/(kg·s²)'},
 {symbol:'g',name:'Standard gravity',value:9.80665,unit:'m/s²'},
 {symbol:'ε₀',name:'Vacuum permittivity',value:8.8541878128e-12,unit:'F/m'},
 {symbol:'μ₀',name:'Vacuum permeability',value:1.25663706212e-6,unit:'N/A²'},
 {symbol:'F',name:'Faraday constant',value:96485.33212,unit:'C/mol'},
 {symbol:'α',name:'Fine-structure constant',value:7.2973525693e-3,unit:'—'},
 {symbol:'R∞',name:'Rydberg constant',value:10973731.56816,unit:'m⁻¹'},
 {symbol:'a₀',name:'Bohr radius',value:5.29177210903e-11,unit:'m'},
 {symbol:'μB',name:'Bohr magneton',value:9.2740100783e-24,unit:'J/T'},
 {symbol:'μN',name:'Nuclear magneton',value:5.0507837461e-27,unit:'J/T'},
 {symbol:'σ',name:'Stefan–Boltzmann constant',value:5.670374419e-8,unit:'W/(m²·K⁴)'},
 {symbol:'c₁',name:'First radiation constant',value:3.741771852e-16,unit:'W·m²'},
 {symbol:'c₂',name:'Second radiation constant',value:1.438776877e-2,unit:'m·K'},
 {symbol:'Vₘ',name:'Molar volume (ideal gas)',value:2.24139693e-2,unit:'m³/mol'},
 {symbol:'atm',name:'Standard atmosphere',value:101325,unit:'Pa'},
 {symbol:'u',name:'Atomic mass unit',value:1.66053906660e-27,unit:'kg'},
 {symbol:'Φ₀',name:'Magnetic flux quantum',value:2.067833848e-15,unit:'Wb'},
 {symbol:'G₀',name:'Conductance quantum',value:7.748091729e-5,unit:'S'},
 {symbol:'Z₀',name:'Characteristic impedance',value:376.730313668,unit:'Ω'},
 {symbol:'t',name:'Celsius zero point',value:273.15,unit:'K'},
 {symbol:'eV',name:'Electron volt',value:1.602176634e-19,unit:'J'},
 {symbol:'ly',name:'Light year',value:9.4607304725808e15,unit:'m'},
 {symbol:'AU',name:'Astronomical unit',value:1.495978707e11,unit:'m'},
 {symbol:'pc',name:'Parsec',value:3.0856775814913673e16,unit:'m'},
 {symbol:'M☉',name:'Solar mass',value:1.98847e30,unit:'kg'},
 {symbol:'M⊕',name:'Earth mass',value:5.9722e24,unit:'kg'},
 {symbol:'R☉',name:'Solar radius',value:6.957e8,unit:'m'},
 {symbol:'R⊕',name:'Earth radius',value:6.371e6,unit:'m'},
 {symbol:'ρ',name:'Water density (4 °C)',value:999.972,unit:'kg/m³'},
 {symbol:'v₀',name:'Speed of sound (air, 0 °C)',value:331.3,unit:'m/s'},
];

export interface ConversionUnit{name:string;symbol:string;toBase:(value:number)=>number;fromBase:(value:number)=>number}
export interface ConversionCategory{name:string;units:ConversionUnit[]}
const linearUnit=(name:string,symbol:string,factor:number):ConversionUnit=>({
 name,symbol,toBase:value=>value*factor,fromBase:value=>value/factor,
});
const temperatureUnit=(name:string,symbol:string,toBase:(value:number)=>number,fromBase:(value:number)=>number):ConversionUnit=>({name,symbol,toBase,fromBase});
export const unitConversions:ConversionCategory[]=[
 {name:'Length',units:[
  linearUnit('Metre','m',1),linearUnit('Kilometre','km',1000),linearUnit('Centimetre','cm',0.01),
  linearUnit('Millimetre','mm',0.001),linearUnit('Inch','in',0.0254),linearUnit('Foot','ft',0.3048),
  linearUnit('Yard','yd',0.9144),linearUnit('Mile','mi',1609.344),linearUnit('Nautical mile','nmi',1852),
  linearUnit('Light year','ly',9.4607304725808e15),linearUnit('Astronomical unit','AU',1.495978707e11),
 ]},
 {name:'Mass',units:[
  linearUnit('Kilogram','kg',1),linearUnit('Gram','g',0.001),linearUnit('Milligram','mg',1e-6),
  linearUnit('Tonne','t',1000),linearUnit('Ounce','oz',0.028349523125),linearUnit('Pound','lb',0.45359237),
  linearUnit('Stone','st',6.35029318),linearUnit('US ton','ton',907.18474),
 ]},
 {name:'Temperature',units:[
  temperatureUnit('Celsius','°C',value=>value+273.15,value=>value-273.15),
  temperatureUnit('Kelvin','K',value=>value,value=>value),
  temperatureUnit('Fahrenheit','°F',value=>(value-32)*5/9+273.15,value=>(value-273.15)*9/5+32),
  temperatureUnit('Rankine','°R',value=>value*5/9,value=>value*9/5),
 ]},
 {name:'Area',units:[
  linearUnit('Square metre','m²',1),linearUnit('Square centimetre','cm²',1e-4),
  linearUnit('Square kilometre','km²',1e6),linearUnit('Hectare','ha',10000),
  linearUnit('Square inch','in²',0.00064516),linearUnit('Square foot','ft²',0.09290304),
  linearUnit('Acre','ac',4046.8564224),linearUnit('Square mile','mi²',2589988.110336),
 ]},
 {name:'Volume',units:[
  linearUnit('Cubic metre','m³',1),linearUnit('Litre','L',0.001),linearUnit('Millilitre','mL',1e-6),
  linearUnit('Cubic centimetre','cm³',1e-6),linearUnit('Cubic inch','in³',1.6387064e-5),
  linearUnit('Cubic foot','ft³',0.028316846592),linearUnit('US gallon','gal',0.003785411784),
  linearUnit('US pint','pt',0.000473176473),linearUnit('Imperial gallon','gal(UK)',0.00454609),
 ]},
 {name:'Speed',units:[
  linearUnit('Metre per second','m/s',1),linearUnit('Kilometre per hour','km/h',1/3.6),
  linearUnit('Mile per hour','mph',0.44704),linearUnit('Foot per second','ft/s',0.3048),
  linearUnit('Knot','kn',0.514444444),linearUnit('Mach','Ma',340.29),
 ]},
 {name:'Energy',units:[
  linearUnit('Joule','J',1),linearUnit('Kilojoule','kJ',1000),linearUnit('Calorie','cal',4.184),
  linearUnit('Kilocalorie','kcal',4184),linearUnit('Watt hour','Wh',3600),
  linearUnit('Kilowatt hour','kWh',3.6e6),linearUnit('Electron volt','eV',1.602176634e-19),
  linearUnit('British thermal unit','BTU',1055.05585262),
 ]},
 {name:'Pressure',units:[
  linearUnit('Pascal','Pa',1),linearUnit('Kilopascal','kPa',1000),linearUnit('Bar','bar',1e5),
  linearUnit('Atmosphere','atm',101325),linearUnit('Torr','Torr',133.322368421),
  linearUnit('Millimetre of mercury','mmHg',133.322387415),linearUnit('PSI','psi',6894.757293168),
 ]},
 {name:'Power',units:[
  linearUnit('Watt','W',1),linearUnit('Kilowatt','kW',1000),linearUnit('Megawatt','MW',1e6),
  linearUnit('Horsepower (metric)','PS',735.49875),linearUnit('Horsepower (mechanical)','hp',745.699871582),
 ]},
 {name:'Time',units:[
  linearUnit('Second','s',1),linearUnit('Minute','min',60),linearUnit('Hour','h',3600),
  linearUnit('Day','d',86400),linearUnit('Week','wk',604800),linearUnit('Year','yr',31557600),
 ]},
 {name:'Angle',units:[
  linearUnit('Degree','°',Math.PI/180),linearUnit('Radian','rad',1),
  linearUnit('Gradian','grad',Math.PI/200),linearUnit('Arcminute','′',Math.PI/10800),
  linearUnit('Arcsecond','″',Math.PI/648000),
 ]},
];

export function convertUnit(category:ConversionCategory,from:ConversionUnit,to:ConversionUnit,value:number):number{
 return to.fromBase(from.toBase(value));
}

export function formatMatrix(matrix:Matrix):string{
 return matrix.map(row=>`[${row.map(value=>plainNumber(value)).join('  ')}]`).join('\n');
}
export function formatVector(vector:number[]):string{
 return `[${vector.map(value=>plainNumber(value)).join('  ')}]`;
}
