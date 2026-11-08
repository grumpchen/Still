import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePdfValues,decodePdfCalculation,encodePdfCalculation,scanPdfNumbers} from '../src/domain/pdfCalculations.ts';

test('scans signed, decimal, grouped, scientific, and fractional PDF values',()=>{
 const found=scanPdfNumbers('x=-12.5, total 1,200; ratio .25; rate 3e-2; fraction 3/4');
 assert.deepEqual(found.map(item=>item.value),[-12.5,1200,.25,.03,.75]);
});

test('evaluates arithmetic in selected order',()=>{
 assert.equal(calculatePdfValues([2,3,4],'+'),9);
 assert.equal(calculatePdfValues([12,3,2],'-'),7);
 assert.equal(calculatePdfValues([2,3,4],'×'),24);
 assert.equal(calculatePdfValues([24,3,2],'÷'),4);
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
