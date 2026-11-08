import {expect,test} from '@playwright/test';

function textPdf(pages:readonly string[]):string{
 const pageIds=pages.map((_,index)=>4+index*2),fontId=3;
 const objects=[
  '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
  `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ...pages.flatMap((text,index)=>{
   const pageId=pageIds[index],contentId=pageId+1,escaped=text.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
   const stream=`BT /F1 20 Tf 72 700 Td (${escaped}) Tj ET\n`;
   return [
    `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
   ];
  }),
 ];
 let pdf='%PDF-1.4\n',offsets=[0];
 for(const object of objects){offsets.push(Buffer.byteLength(pdf));pdf+=object}
 const xref=Buffer.byteLength(pdf);
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf,'ascii').toString('base64');
}

test('PDF keyword highlights render across pages, survive reload, zoom with the page, and clear locally',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/tests/e2e/fixtures/pdf-viewer.html',{waitUntil:'commit'});
 await expect.poll(()=>page.evaluate(()=>typeof window.mountPdfViewer==='function'),{timeout:60000}).toBe(true);
 await page.evaluate(base64=>window.mountPdfViewer?.(base64),textPdf(['Mitochondria produce ATP.','ATP powers muscle contraction.']));
 expect(await page.evaluate(()=>window.pdfFixtureNative)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>window.pdfFixturePreviewResolved===true),{timeout:5000}).toBe(true);
 const textSpan=page.locator('.pdf-text-layer > span').filter({hasText:'Mitochondria produce ATP.'}).first();
 const selectionBounds=await textSpan.evaluate(element=>{const span=element as HTMLElement,text=span.firstChild;if(!text)return null;const range=document.createRange();range.setStart(text,0);range.setEnd(text,12);const rect=range.getBoundingClientRect();return{left:rect.left,top:rect.top,width:rect.width,height:rect.height}});
 expect(selectionBounds).not.toBeNull();
 await page.mouse.move(selectionBounds!.left+1,selectionBounds!.top+selectionBounds!.height/2);await page.mouse.down();await page.mouse.move(selectionBounds!.left+selectionBounds!.width-1,selectionBounds!.top+selectionBounds!.height/2,{steps:8});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('Mitochondria');
 await page.evaluate(()=>window.getSelection()?.removeAllRanges());
 const toolbar=page.locator('.pdf-viewer-toolbar');
 await expect(toolbar.getByRole('button',{name:'AI highlight keywords'})).toBeEnabled();
 await page.evaluate(()=>{
  window.addEventListener('still-assistant-resource',event=>{(window as Window&{pdfHighlightRequest?:CustomEvent}).pdfHighlightRequest=event as CustomEvent},{once:true});
 });
 await toolbar.getByRole('button',{name:'AI highlight keywords'}).click();
 await expect.poll(()=>page.evaluate(()=>!!(window as Window&{pdfHighlightRequest?:CustomEvent}).pdfHighlightRequest)).toBe(true);
 const request=await page.evaluate(()=>{const detail=(window as Window&{pdfHighlightRequest:CustomEvent<{requestId:string;text:string}>}).pdfHighlightRequest.detail;return{requestId:detail.requestId,text:detail.text}});
 expect(request.text).toContain('Page 1\nMitochondria produce ATP.');expect(request.text).toContain('Page 2\nATP powers muscle contraction.');
 const requestId=request.requestId;
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('still-pdf-keywords-ready',{detail:{requestId:id,keywords:['Mitochondria','ATP']}})),requestId);
 const review=page.locator('.pdf-keyword-review');await expect(review).toBeVisible();
 await review.getByRole('button',{name:'Apply highlights'}).click();
 const highlight=page.locator('.pdf-keyword-highlight');await expect(highlight).toHaveCount(2);
 const initial=await highlight.first().evaluate(element=>({left:parseFloat((element as HTMLElement).style.left),top:parseFloat((element as HTMLElement).style.top),width:parseFloat((element as HTMLElement).style.width)}));
 expect(initial.left).toBeGreaterThan(30);expect(initial.top).toBeGreaterThan(20);expect(initial.width).toBeGreaterThan(20);
 const exactTextBounds=await page.locator('.pdf-text-layer > span').filter({hasText:'Mitochondria produce ATP.'}).first().evaluate(element=>{const span=element as HTMLElement,text=span.firstChild;if(!text)return null;const range=document.createRange();range.setStart(text,0);range.setEnd(text,12);const rect=range.getBoundingClientRect(),stage=span.closest('.pdf-page-stage')!.getBoundingClientRect();return{left:rect.left-stage.left,top:rect.top-stage.top,width:rect.width}});
 expect(exactTextBounds).not.toBeNull();expect(Math.abs(initial.left-exactTextBounds!.left)).toBeLessThan(1);expect(Math.abs(initial.top-exactTextBounds!.top)).toBeLessThan(1);expect(Math.abs(initial.width-exactTextBounds!.width)).toBeLessThan(1);
 const pageInk=await page.locator('.pdf-page-stage > canvas').evaluate(element=>{const canvas=element as HTMLCanvasElement,context=canvas.getContext('2d');if(!context)return 0;const sx=canvas.width/parseFloat(canvas.style.width),sy=canvas.height/parseFloat(canvas.style.height),pixels=context.getImageData(Math.round(65*sx),Math.round(65*sy),Math.round(150*sx),Math.round(45*sy)).data;let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100)ink++;return ink});
 expect(pageInk).toBeGreaterThan(10);
 await page.evaluate(()=>window.remountPdfViewer?.());await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(2);
 await toolbar.getByRole('button',{name:'Zoom in'}).click();await expect(toolbar).toContainText('115%');
 await expect.poll(()=>highlight.first().evaluate(element=>parseFloat((element as HTMLElement).style.width))).toBeGreaterThan(initial.width*1.05);
 await toolbar.getByRole('button',{name:'Next page'}).click();await expect(toolbar).toContainText('Page 2 of 2');
 const secondPageText=page.locator('.pdf-text-layer > span').filter({hasText:'ATP powers muscle contraction.'}).first();await expect(secondPageText).toBeVisible();
 await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(1);
 const secondPageBounds=await secondPageText.evaluate(element=>{const span=element as HTMLElement,text=span.firstChild;if(!text)return null;const range=document.createRange();range.setStart(text,0);range.setEnd(text,3);const rect=range.getBoundingClientRect(),stage=span.closest('.pdf-page-stage')!.getBoundingClientRect();return{left:rect.left-stage.left,top:rect.top-stage.top,width:rect.width}});
 const secondHighlight=await page.locator('.pdf-keyword-highlight').first().evaluate(element=>{const item=element as HTMLElement;return{left:parseFloat(item.style.left),top:parseFloat(item.style.top),width:parseFloat(item.style.width)}});
 expect(secondPageBounds).not.toBeNull();expect(Math.abs(secondHighlight.left-secondPageBounds!.left)).toBeLessThan(1);expect(Math.abs(secondHighlight.top-secondPageBounds!.top)).toBeLessThan(1);expect(Math.abs(secondHighlight.width-secondPageBounds!.width)).toBeLessThan(1);
 await toolbar.getByRole('button',{name:'Clear highlights'}).click();await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(0);
 await toolbar.getByRole('button',{name:'Previous page'}).click();await expect(toolbar).toContainText('Page 1 of 2');await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(0);
});
