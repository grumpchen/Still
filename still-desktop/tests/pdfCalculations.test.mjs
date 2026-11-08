import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePdfValues,decodePdfCalculation,encodePdfCalculation,includePdfNumberSelection,pdfOperationAt,scanPdfNumbers,togglePdfNumberSelection} from '../src/domain/pdfCalculations.ts';

test('scans signed, decimal, grouped, scientific, and fractional PDF values',()=>{
 const found=scanPdfNumbers('x=-12.5, total 1,200; ratio .25; rate 3e-2; fraction 3/4. Also 3.5. Version 3.5.2 stays whole.');
 assert.deepEqual(found.map(item=>item.value),[-12.5,1200,.25,.03,.75,3.5]);
});

test('evaluates arithmetic in selected order',()=>{
 assert.equal(calculatePdfValues([2,3,4],'+'),9);
 assert.equal(calculatePdfValues([12,3,2],'-'),7);
 assert.equal(calculatePdfValues([2,3,4],'×'),24);
 assert.equal(calculatePdfValues([24,3,2],'÷'),4);
});

test('radial wheel directions map to the matching arithmetic operations',()=>{
 assert.equal(pdfOperationAt(100,0),'+');
 assert.equal(pdfOperationAt(0,100),'-');
 assert.equal(pdfOperationAt(-100,0),'×');
 assert.equal(pdfOperationAt(0,-100),'÷');
});

test('number selection toggles with Ctrl and refuses values beyond its limit',()=>{
 assert.deepEqual(togglePdfNumberSelection(['a'],'b',true),['a','b']);
 assert.deepEqual(togglePdfNumberSelection(['a','b'],'a',true),['b']);
 assert.deepEqual(togglePdfNumberSelection(['a','b'],'c',false),['c']);
 assert.equal(togglePdfNumberSelection(['a','b'],'c',true,2),null);
});

test('opening the radial wheel on a selected number preserves the complete Ctrl selection',()=>{
 assert.deepEqual(includePdfNumberSelection(['first','second'],'first'),['first','second']);
 assert.deepEqual(includePdfNumberSelection(['first'],'second'),['first','second']);
 assert.equal(includePdfNumberSelection(['first','second'],'third',2),null);
});

test('rejects undefined, oversized, and malformed calculations',()=>{
 assert.throws(()=>calculatePdfValues([4,0],'÷'),/zero/);
 assert.throws(()=>calculatePdfValues(Array(33).fill(1),'+'),/32/);
 assert.throws(()=>calculatePdfValues([Number.MAX_VALUE,2],'×'),/numeric range/);
 assert.throws(()=>encodePdfCalculation([1,Number.NaN],'+'),/valid/);
 assert.equal(decodePdfCalculation('{broken'),null);
 assert.equal(decodePdfCalculation(JSON.stringify({values:[2],operation:'power'})),null);
 assert.deepEqual(decodePdfCalculation(encodePdfCalculation([2,5],'+')),{values:[2,5],operation:'+'});
});
