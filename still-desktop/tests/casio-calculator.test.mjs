import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 evaluate,formatNumber,formatValue,toFraction,
 stat1,stat2,solveLinear2,solveLinear3,solveQuadratic,solveCubic,
 matrixDet,matrixInverse,matrixMul,vectorDot,vectorCross,vectorNorm,
 numericIntegral,numericDerivative,solveEquation,
 unitConversions,convertUnit,CasioError,
} from '../src/domain/casioMath.ts';

const close=(actual,expected,tolerance=1e-9)=>{
 assert.ok(Math.abs(actual-expected)<tolerance,`expected ${actual} to be within ${tolerance} of ${expected}`);
};
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('expression engine handles arithmetic, precedence and implicit multiplication',()=>{
 assert.equal(evaluate('2+3*4'),14);
 assert.equal(evaluate('(2+3)*4'),20);
 assert.equal(evaluate('-2^2'),-4);
 assert.equal(evaluate('2^3^2'),512);
 close(evaluate('2π'),2*Math.PI);
 close(evaluate('3(4+5)'),27);
 assert.equal(evaluate('3!'),6);
 assert.equal(evaluate('nCr(5,2)'),10);
 assert.equal(evaluate('nPr(5,2)'),20);
 assert.equal(evaluate('gcd(12,18)'),6);
 assert.equal(evaluate('lcm(4,6)'),12);
 close(evaluate('root(3,27)'),3);
});

test('angle modes, logarithms and percentages work',()=>{
 close(evaluate('sin(30)',{angle:'DEG'}),0.5);
 close(evaluate('cos(60)',{angle:'DEG'}),0.5);
 close(evaluate('sin(π/2)',{angle:'RAD'}),1);
 close(evaluate('asin(0.5)',{angle:'DEG'}),30);
 assert.equal(evaluate('log(100)'),2);
 close(evaluate('ln(e)'),1);
 close(evaluate('log(2,8)'),3);
 close(evaluate('50%'),0.5);
 close(evaluate('12°30′'),12.5);
 close(evaluate('1 1⁄2'),1.5);
});

test('variables, Ans and memory resolve like the real calculator',()=>{
 assert.equal(evaluate('A+1',{variables:{A:2}}),3);
 assert.equal(evaluate('Ans*2',{ans:5}),10);
 assert.equal(evaluate('M+1',{memory:2}),3);
 assert.deepEqual(evaluate('1+2i',{complex:true}),{re:1,im:2});
 assert.deepEqual(evaluate('sqrt(-4)',{complex:true}),{re:0,im:2});
 assert.throws(()=>evaluate('sqrt(-4)'),CasioError);
 assert.throws(()=>evaluate('1/0'),/Math ERROR/);
});

test('display formatting covers NORM, FIX, SCI, fractions and sexagesimal',()=>{
 assert.equal(formatNumber(0.1+0.2,{kind:'NORM',digits:1}),'0.3');
 assert.equal(formatNumber(1234.5678,{kind:'FIX',digits:2}),'1234.57');
 assert.equal(formatNumber(1234.5678,{kind:'SCI',digits:3}),'1.235×10³');
 assert.equal(formatValue(1/3,{display:{kind:'NORM',digits:1},fraction:true}),'1/3');
 assert.equal(formatValue(1.5,{display:{kind:'NORM',digits:1},fraction:true}),'1 1/2');
 assert.equal(formatValue(3/2,{display:{kind:'NORM',digits:1},fraction:true,improper:true}),'3/2');
 assert.equal(formatValue(12.5,{display:{kind:'NORM',digits:1},sexagesimal:true}),'12°30′0″');
 assert.deepEqual(toFraction(0.75),{n:3,d:4});
});

test('statistics match the fx-570E 1-VAR and 2-VAR outputs',()=>{
 const one=stat1([{x:1},{x:2},{x:3}]);
 assert.equal(one.n,3);
 assert.equal(one.sum,6);
 assert.equal(one.mean,2);
 close(one.sampleSd,1);
 close(one.populationSd,Math.sqrt(2/3));
 assert.equal(one.median,2);
 assert.equal(one.min,1);
 assert.equal(one.max,3);

 const two=stat2([{x:1,y:2},{x:2,y:4},{x:3,y:6}]);
 assert.equal(two.n,3);
 close(two.meanX,2);
 close(two.meanY,4);
 close(two.r,1);
 close(two.a,0);
 close(two.b,2);
});

test('equation solvers cover simultaneous, quadratic and cubic systems',()=>{
 assert.deepEqual(solveLinear2(2,1,5,1,-1,1),[2,1]);
 const three=solveLinear3([[1,1,1,6],[0,2,5,-4],[2,5,-1,27]]);
 close(three[0],5);close(three[1],3);close(three[2],-2);
 assert.deepEqual(solveQuadratic(1,0,-4),[-2,2]);
 const cubic=solveCubic(1,-6,11,-6).map(value=>typeof value==='number'?value:NaN).sort((a,b)=>a-b);
 close(cubic[0],1);close(cubic[1],2);close(cubic[2],3);
});

test('matrix and vector operations work',()=>{
 assert.equal(matrixDet([[1,2],[3,4]]),-2);
 const inverse=matrixInverse([[4,7],[2,6]]);
 close(inverse[0][0],0.6);close(inverse[0][1],-0.7);
 close(inverse[1][0],-0.2);close(inverse[1][1],0.4);
 assert.deepEqual(matrixMul([[1,2],[3,4]],[[5,6],[7,8]]),[[19,22],[43,50]]);
 assert.equal(vectorDot([1,2,3],[4,5,6]),32);
 assert.deepEqual(vectorCross([1,0,0],[0,1,0]),[0,0,1]);
 close(vectorNorm([3,4]),5);
});

test('calculus helpers integrate, differentiate and solve',()=>{
 close(numericIntegral(x=>x*x,0,3),9,1e-6);
 close(numericDerivative(x=>x*x,3),6,1e-5);
 close(solveEquation(x=>x*x-4,1),2,1e-8);
});

test('unit conversion data is usable',()=>{
 const length=unitConversions.find(category=>category.name==='Length');
 const metres=length.units.find(unit=>unit.symbol==='m');
 const centimetres=length.units.find(unit=>unit.symbol==='cm');
 close(convertUnit(length,metres,centimetres,2.5),250);
 const temperature=unitConversions.find(category=>category.name==='Temperature');
 const celsius=temperature.units.find(unit=>unit.symbol==='°C');
 const fahrenheit=temperature.units.find(unit=>unit.symbol==='°F');
 close(convertUnit(temperature,celsius,fahrenheit,100),212);
});

test('Casio FX-570E is registered as a normal tool with its own renderer',()=>{
 const catalog=source('../src/domain/widgetCatalog.ts');
 assert.match(catalog,/casio570:\s*\{name:'Casio FX-570E',\s*icon:'casio'/);
 assert.match(catalog,/casio570:.*minWidth:/);
 const widgets=source('../src/widgets.tsx');
 assert.match(widgets,/import CasioCalculator from '\.\/CasioCalculator\.tsx'/);
 assert.match(widgets,/casio570:CasioCalculator/);
 const icons=source('../src/Icon.tsx');
 assert.match(icons,/casio:'M5 2h14v20H5z/);
 const localization=source('../src/localization.tsx');
 assert.match(localization,/widget_casio570:'Casio FX-570E'/);
});

test('the calculator widget renders the FX-570E shell, LCD, keypad and modes',()=>{
 const component=source('../src/CasioCalculator.tsx');
 assert.match(component,/className="casio570"/);
 assert.match(component,/className="casio-lcd"/);
 assert.match(component,/className="casio-function-grid"/);
 assert.match(component,/className="casio-number-grid"/);
 assert.match(component,/className="casio-replay"/);
 for(const label of ['COMP','STAT','CMPLX','EQN','MAT','VCT','TABLE','CONST','CONV'])assert.ok(component.includes(`id:'${label}'`),`${label} mode is present`);
 for(const key of ['SHIFT','ALPHA','MODE','ON','CALC','∫dx','S⇔D','CONST','CONV','nPr','nCr'])assert.ok(component.includes(`label="${key}"`),`${key} key is present`);
 assert.match(component,/label="sin"/);
 assert.match(component,/label="x²"/);
 assert.match(component,/label="Ans"/);
});

test('the calculator is styled as a black Casio body',()=>{
 const styles=source('../src/canvas.css');
 assert.match(styles,/\.casio570\{[^}]*background:radial-gradient/);
 assert.match(styles,/\.casio-lcd\{/);
 assert.match(styles,/\.casio-key\{/);
 assert.match(styles,/\.casio-key\.casio-shift\{/);
 assert.match(styles,/\.casio-key\.casio-alpha\{/);
 assert.match(styles,/\.casio-function-grid\{display:grid;grid-template-columns:repeat\(6/);
 assert.match(styles,/\.casio-number-grid\{display:grid;grid-template-columns:repeat\(5/);
});
