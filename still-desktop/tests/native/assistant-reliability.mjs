// Opt-in Windows integration test. Run from still-desktop with node --import tsx.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect as playwrightExpect } from '@playwright/test';
import { createInitialState, createWidget, createWorkspace } from '../../src/domain/workspaces.ts';

const mode = process.argv[2];
const expect=playwrightExpect.configure({timeout:15_000});
assert(process.platform === 'win32' && process.env.APPDATA, 'This fixture requires Windows with WebView2.');
assert(['success','stale','timeout','restart','revoke','theme','move-widget','resize-widget','library-edit','library-conflict','library-create','pdf-highlights','files-viewers'].includes(mode), 'Specify an acceptance case from tests/native/README.md.');
const libraryCase = mode.startsWith('library-');
const pdfCase = mode==='pdf-highlights';
const filesViewerCase = mode==='files-viewers';
const geometry = mode==='move-widget'?{operation:'move',x:100,y:80}:mode==='resize-widget'?{operation:'resize',width:480,height:360}:null;
const project = fileURLToPath(new URL('../../', import.meta.url));
const cargoTarget = resolve(project, process.env.STILL_FIXTURE_CARGO_TARGET || 'src-tauri/target');
const executable = join(cargoTarget, 'debug', 'still-desktop.exe');
const token = randomUUID().replaceAll('-', '');
const identifier = 'nz.personal.still.assistantfixture.' + token;
const title = 'Still Assistant Fixture ' + token;
const fixture = join(cargoTarget, 'assistant-native-fixtures', token);
const profile = join(fixture, 'WebView');
const inbox = join(fixture, 'Inbox');
const notesRoot = join(fixture, 'Notes');
const pdfRoot = join(fixture, 'PDF');
const grants = join(process.env.APPDATA, identifier);
const grantFile = join(grants, 'file-folders.json');
const config = join(fixture, 'tauri.json');
let url;
const bootstrapPath = '/__still_fixture_bootstrap';
const files = ['first.md','second.md'];
const runOutput = [];
const children = new Set();
const bindings = new Map();
let fixturePage;
const canonical = path => path.replace(/^\\\\\?\\/, '').toLowerCase();
const state = createInitialState();
const library = state.workspaces.find(workspace => workspace.role === 'library');
const downloads = createWidget('files');
downloads.title = 'Downloads Inbox';
downloads.folderKey = 'still-downloads-inbox';
downloads.folderName = 'Fixture Inbox';
library.widgets = library.widgets.filter(widget => widget.folderKey !== 'still-downloads-inbox').concat(downloads);
const canvas = createWorkspace('Native agent fixture', []);
const notes = createWidget('notes');
if(libraryCase||geometry||pdfCase){
  notes.title='Fixture Notes';
  if(libraryCase||pdfCase){notes.notesLibraryKey=notes.id;notes.notesLibraryName=pdfCase?'Fixture PDF Library':'Fixture Notes Library';}
  canvas.widgets.push(notes);
}
if(filesViewerCase){
  const files=createWidget('files');
  files.title='Fixture Course Files';
  files.folderKey=downloads.id;
  files.folderName='Fixture Inbox';
  canvas.widgets.push(files);
}
state.workspaces.push(canvas);
state.activeId = canvas.id;
state.theme = 'light';

function processForPath() {
  const command = "Get-Process | Where-Object { $_.ProcessName -eq 'still-desktop' -and $_.Path -eq $env:STILL_FIXTURE_EXE } | Select-Object Id,MainWindowTitle | ConvertTo-Json -Compress; exit 0";
  const result = execFileSync('powershell.exe',['-NoProfile','-Command',command],{
    env:{...process.env,STILL_FIXTURE_EXE:executable},encoding:'utf8',windowsHide:true,
  }).trim();
  return result ? [JSON.parse(result)].flat() : [];
}

function start(script, args, env = {}) {
  const proc = spawn(process.execPath,[join(project,script),...args],{
    cwd:project,windowsHide:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe'],
  });
  children.add(proc);
  const buffer = chunk => { runOutput.push(String(chunk)); if (runOutput.length > 35) runOutput.shift(); };
  proc.stdout.on('data',buffer);
  proc.stderr.on('data',buffer);
  proc.on('error',error=>buffer(error.message));
  proc.on('exit',()=>children.delete(proc));
  return proc;
}

async function reservePort(port) {
  const server = createServer();
  const free = new Promise((ok,fail)=>{
    server.once('error',fail);
    server.listen(port,'127.0.0.1',()=>ok(server.address().port));
  });
  try { return await free; }
  finally { if (server.listening) await new Promise(ok=>server.close(ok)); }
}

async function waitFor(check, description, timeout = 20_000) {
  const until = Date.now()+timeout;
  while (Date.now()<until) {
    const value = await check();
    if (value) return value;
    await delay(150);
  }
  throw new Error('Timed out waiting for '+description);
}

async function get(url) {
  try { const response = await fetch(url,{signal:AbortSignal.timeout(1000)}); return response.ok ? response : null; }
  catch { return null; }
}

function stopFixture() {
  for (const candidate of processForPath()) {
    if (candidate.MainWindowTitle === title) process.kill(candidate.Id);
  }
}

async function setGrant(path) {
  const grantWidget=libraryCase||pdfCase?notes:null,grantRoot=libraryCase?notesRoot:pdfCase?pdfRoot:null;
  await writeFile(grantFile,JSON.stringify({'still-downloads-inbox':path,[downloads.id]:path,...(grantWidget&&grantRoot?{[grantWidget.id]:grantRoot}:{})}),'utf8');
}

async function openNative(port) {
  start('scripts/dev-desktop.mjs',['--no-watch','--config',config],{
    CARGO_TARGET_DIR:cargoTarget,WEBVIEW2_USER_DATA_FOLDER:profile,
    STILL_FIXTURE_TRUSTED_DEV_PORT:String(new URL(url).port),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port='+port+' --remote-debugging-address=127.0.0.1',
  });
  await waitFor(()=>get('http://127.0.0.1:'+port+'/json/version'),'native WebView CDP endpoint',180_000);
  const native = await waitFor(()=>processForPath().find(candidate=>candidate.MainWindowTitle===title),'identified Still fixture process');
  assert.equal(processForPath().length,1,'Unexpected process at the fixture executable path.');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page = await waitFor(()=>browser.contexts().flatMap(context=>context.pages()).find(item=>item.url()===new URL(bootstrapPath,url).href),'fixture bootstrap WebView');
  page.setDefaultTimeout(20_000);
  bindings.set(page,native.Id);
  fixturePage=page;
  return page;
}

function textPdf(text) {
  const escaped=text.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
  const stream=`BT /F1 20 Tf 72 700 Td (${escaped}) Tj ET\n`;
  const objects=[
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  for(const object of objects){offsets.push(Buffer.byteLength(pdf));pdf+=object}
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'ascii');
}

async function installProviderStub(page, recovered=false) {
  await page.route(/\/src\/platform\/assistant\.ts(\?|$)/,async route=>{
    const response=await route.fetch();
    const source=await response.text();
    const fixtureCode=`
chatgptPlan.status=async()=>({connected:true,email:null});
chatgptPlan.models=async()=>[{slug:'gpt-fixture',display_name:'Fixture'}];
window.__fixtureTurns=[];
geminiAssistant.agentTurn=async function(request){
 const records=window.__fixtureTurns;records.push(request);
 const call=(name,input,id)=>({kind:'tool_calls',assistantMessage:{role:'assistant',tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(input)}}]},calls:[{id,name,input}]});
 const receipt=request.messages.at(-1).role==='tool'?JSON.parse(request.messages.at(-1).content):null;
 if(${JSON.stringify(pdfCase)}){
  if(records.length!==1)throw new Error('Unexpected number of PDF keyword provider calls.');
  window.__fixturePdfRequest=request;
  return {kind:'final',response:{intent:'chat',reply:'{"keywords":["Mitochondria","ATP"]}',layout:[],actions:[]}};
 }
 if(${JSON.stringify(mode==='library-create')}){
  if(!request.enable_library_tool||!request.enable_library_edit_tool)throw new Error('The selected Notes Library and note creation tool are not enabled.');
  if(records.length===1)return call('inspect_library',{},'fixture-library-inspect');
  if(records.length===2)return call('propose_library_create_note',{location:'Course',title:'AI Summary',text:'## Key ideas\\nA locally created lecture summary.'},'fixture-library-create');
  if(receipt?.result?.receipt!=='Created Course/AI Summary.md in the selected Notes Library after review.')throw new Error('Did not receive the verified native creation receipt.');
  return {kind:'final',response:{intent:'chat',reply:'Fixture Library note creation complete.',layout:[],actions:[]}};
 }
 if(${JSON.stringify(libraryCase)}){
  if(!request.enable_library_tool||!request.enable_library_edit_tool)throw new Error('The selected Notes Library and edit tools are not enabled.');
  if(records.length===1)return call('inspect_library',{},'fixture-library-inspect');
  if(records.length===2)return call('search_library',{query:'lesson'},'fixture-library-search');
  if(records.length===3)return call('read_library_file',{path:'lesson.md'},'fixture-library-read');
  if(records.length===4){
   if(receipt.result.text!=='Original study note.\\n')throw new Error('Did not receive the synthetic Notes Library text.');
   return call('propose_library_edit',{path:'lesson.md',text:'Revised study note.\\n'},'fixture-library-edit');
  }
  return {kind:'final',response:{intent:'chat',reply:'Fixture Library workflow complete.',layout:[],actions:[]}};
 }
 if(${JSON.stringify(mode==='theme'||!!geometry)}){
  if(records.length===1)return call('inspect_workspace',{},'fixture-workspace');
  if(records.length===2)return call('propose_workspace_action',{snapshotRevision:receipt.result.revision,action:${JSON.stringify(geometry?{type:'set_widget_geometry',ids:[notes.id],...geometry}:{type:'set_setting',ids:['theme'],settingValue:'dark'})}},'fixture-control');
  return {kind:'final',response:{intent:'chat',reply:'Fixture control workflow complete.',layout:[],actions:[]}};
 }
 if(records.length===1)return call('inspect_inbox',{},'fixture-inspect');
 if(records.length===2)return call('propose_inbox_moves',{fileProposals:${JSON.stringify(recovered?['second.md']:files)}.map(sourcePath=>({sourceWidgetId:receipt.result.sourceWidgetId,sourcePath,destinationFolder:'Filed',reason:'Fixture request.'}))},'fixture-move');
 if(records.length===3 && ${JSON.stringify(recovered)})return {kind:'final',response:{intent:'chat',reply:'Fixture recovery follow-up complete.',layout:[],actions:[]}};
 if(records.length===3 && ${JSON.stringify(mode)}==='timeout')throw new Error('Synthetic provider timeout after native receipt.');
 if(records.length===3)return call('inspect_workspace',{},'fixture-workspace');
 if(records.length===4)return call('add_widget',{widgetType:'calendar',snapshotRevision:receipt.result.revision},'fixture-widget');
 return {kind:'final',response:{intent:'chat',reply:'Fixture workflow complete.',layout:[],actions:[]}};
};`;
    await route.fulfill({response,body:source+'\n'+fixtureCode});
  });
  if (!recovered&&(mode==='restart'||mode==='revoke'||mode==='stale')) {
    // Pause the second dispatch in the WebView; the first dispatch uses the real Tauri operation.
    await page.route(/\/src\/platform\/files\.ts(\?|$)/,async route=>{
      const response=await route.fetch();
      const source=await response.text();
      await route.fulfill({response,body:source+`
const fixtureMove=localFiles.moveResource;
localFiles.moveResource=async function(...args){
 if(args[1]==='second.md'){
  await new Promise(release=>{window.__fixtureReleaseSecond=release;window.__fixtureSecondHeld=true;});
 }
 return fixtureMove.apply(this,args);
};`});
    });
  }
}

async function seed(page) {
  await page.evaluate(({state})=>{
    localStorage.setItem('still-workspace-v2',JSON.stringify(state));
    localStorage.setItem('still-first-run-tutorial-v1','done');
    localStorage.setItem('still-assistant-model','chatgpt::gpt-fixture');
    localStorage.setItem('still-assistant-chatgpt-plan-safe-actions','true');
  },{state});
  await page.goto(url,{waitUntil:'commit'});
}

async function assertGrant(page, expected) {
  const value=await page.evaluate(async id=>{
    const {localFiles}=await import('/src/platform/files.ts');
    if(!localFiles.native)throw new Error('Not running in the native fixture.');
    return (await localFiles.inbox(id)).path;
  },downloads.id);
  assert.equal(canonical(value),canonical(await realpath(expected)), 'Refusing to test against a different inbox.');
}

async function openAssistant(page) {
  await page.locator('#ai-sidebar').waitFor({state:'attached'});
  await page.keyboard.press('Control+k');
  await page.getByRole('button',{name:'Open AI assistant',exact:true}).click();
  await expect(page.locator('#ai-message')).toBeVisible();
}

async function mentionNotes(page,prompt) {
  const editor=page.locator('#ai-message');
  await editor.fill('@');
  const option=page.getByRole('option').first();
  await expect(option).toBeVisible();
  await option.click();
  await editor.fill(editor.inputValue()+prompt);
}

async function submit(page) {
  await openAssistant(page);
  await page.locator('#ai-message').fill('Move first.md and second.md to Filed in Downloads Inbox, then add a Calendar widget.');
  await page.locator('.assistant-compose').evaluate(form=>form.requestSubmit());
  return page.getByRole('button',{name:'Move file (2)',exact:true});
}

async function assertMoved(name) {
  assert((await stat(join(inbox,'Filed',name))).isFile());
  await assert.rejects(()=>stat(join(inbox,name)),error=>error.code==='ENOENT');
}

async function assertUnmoved(name) {
  assert((await stat(join(inbox,name))).isFile());
  await assert.rejects(()=>stat(join(inbox,'Filed',name)),error=>error.code==='ENOENT');
}

async function countCalendar(page) {
  return page.evaluate(id=>JSON.parse(localStorage.getItem('still-workspace-v2')).workspaces.find(item=>item.id===id).widgets.filter(widget=>widget.type==='calendar').length,canvas.id);
}

async function runControl(page) {
  await openAssistant(page);
  const prompt=mode==='move-widget'?'Move @Notes to x=100 y=80.':mode==='resize-widget'?'Resize @Notes to width=480 height=360.':'Change the theme to dark.';
  await page.locator('#ai-message').fill(prompt);
  await page.locator('.assistant-compose').evaluate(form=>form.requestSubmit());
  const approve=page.getByRole('button',{name:'Approve and apply action',exact:true});
  const persisted=()=>page.evaluate(({id,widgetId,geometry})=>{
    const stored=JSON.parse(localStorage.getItem('still-workspace-v2'));
    if(!geometry)return stored.theme;
    const placement=stored.workspaces.find(item=>item.id===id).widgets.find(widget=>widget.id===widgetId).placement;
    const keys=geometry==='move'?['x','y']:['width','height'];
    return keys.map(key=>placement[key]);
  },{id:canvas.id,widgetId:notes.id,geometry:geometry?.operation});
  const before=await persisted();
  await expect(approve).toBeVisible();
  await expect(page.locator('.assistant-confirmation')).toContainText(geometry?/before.*after/i:/light\s*→\s*dark/i);
  assert.deepEqual(await persisted(),before);
  await approve.click();
  await expect(page.getByText('Fixture control workflow complete.',{exact:true})).toBeVisible();
  assert.deepEqual(await persisted(),mode==='move-widget'?[100,80]:mode==='resize-widget'?[480,360]:'dark');
  const receipt=await page.evaluate(()=>JSON.parse(window.__fixtureTurns[2].messages.at(-1).content));
  assert.equal(receipt.mutation,'applied');
  if(!geometry)assert.match(receipt.result.receipt,/saved.*dark/i);
  await page.getByRole('button',{name:'Undo change',exact:true}).click();
  await expect.poll(persisted).toEqual(before);
}

async function runLibrary(page) {
  if(mode==='library-create'){
    const note=join(notesRoot,'Course','AI Summary.md');
    await mkdir(join(notesRoot,'Course'),{recursive:true});
    await openAssistant(page);
    await mentionNotes(page,'Create a new note in my Notes Library in Course named AI Summary with the key ideas.');
    await page.locator('.assistant-compose').evaluate(form=>form.requestSubmit());
    const review=page.getByRole('region',{name:'Review new Notes Library note',exact:true});
    await expect(review).toContainText('Course/AI Summary.md');
    await expect(review).toContainText('A locally created lecture summary.');
    await assert.rejects(readFile(note));
    await review.getByRole('button',{name:'Approve and create note',exact:true}).click();
    await expect(page.getByText('Fixture Library note creation complete.',{exact:true})).toBeVisible();
    assert.equal(await readFile(note,'utf8'),'## Key ideas\nA locally created lecture summary.');
    const receipt=await page.evaluate(()=>JSON.parse(window.__fixtureTurns[2].messages.at(-1).content));
    assert.equal(receipt.mutation,'applied');
    assert.equal(receipt.result.entry.path,'Course/AI Summary.md');
    return;
  }
  const lesson=join(notesRoot,'lesson.md');
  await openAssistant(page);
  await mentionNotes(page,'Search my Notes Library for lesson, read lesson.md, then edit lesson.md to say Revised study note.');
  await page.locator('.assistant-compose').evaluate(form=>form.requestSubmit());
  const review=page.getByRole('region',{name:'Review Notes Library edit',exact:true});
  await expect(review).toContainText('Original study note.');
  await expect(review).toContainText('Revised study note.');
  assert.equal(await readFile(lesson,'utf8'),'Original study note.\n');
  if(mode==='library-conflict')await writeFile(lesson,'Changed outside Still.\n');
  await review.getByRole('button',{name:'Approve and save edit',exact:true}).click();
  if(mode==='library-conflict'){
    await expect(page.locator('.assistant-error')).toContainText(/changed|reload/i);
    assert.equal(await readFile(lesson,'utf8'),'Changed outside Still.\n');
  }else{
    await expect(page.getByText('Fixture Library workflow complete.',{exact:true})).toBeVisible();
    assert.equal(await readFile(lesson,'utf8'),'Revised study note.\n');
    const receipt=await page.evaluate(()=>JSON.parse(window.__fixtureTurns[4].messages.at(-1).content));
    assert.equal(receipt.mutation,'applied');
  }
}

async function runPdfHighlights(page) {
  const sourcePath=join(pdfRoot,'Lecture.pdf'),before=await readFile(sourcePath),beforeHash=createHash('sha256').update(before).digest('hex');
  const file=page.getByRole('button',{name:'Preview file Lecture.pdf',exact:true});
  await expect(file).toBeVisible();
  await file.click();
  const toolbar=page.locator('.pdf-viewer-toolbar');
  await expect(toolbar.getByRole('button',{name:'AI highlight keywords',exact:true})).toBeEnabled();
  await toolbar.getByRole('button',{name:'AI highlight keywords',exact:true}).click();
  const review=page.locator('.pdf-keyword-review');
  await expect(review).toBeVisible();
  const request=await page.evaluate(()=>window.__fixturePdfRequest);
  assert.equal(request.provider,'chatgpt');
  const userContent=String(request.messages.at(-1).content);
  assert(userContent.includes('selectedPdfText')&&userContent.includes('Mitochondria produce ATP.'));
  assert(userContent.includes('standard Still JSON reply object')&&userContent.includes('inside the reply string')&&userContent.includes('Do not put keywords at the top level'),'PDF prompt must match the provider reply schema.');
  assert(!userContent.includes('Lecture.pdf')&&!userContent.includes(pdfRoot),'PDF path and name must not be shared with the provider.');
  assert(!userContent.includes('User memory context'),'Saved assistant memory must stay out of PDF keyword requests.');
  await review.getByRole('button',{name:'Apply highlights',exact:true}).click();
  await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(2);
  const stored=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('still.pdf-highlights.v1.')));
  assert.equal(stored.length,1);
  assert.deepEqual(JSON.parse(stored[0][1]),['Mitochondria','ATP']);
  assert.equal(createHash('sha256').update(await readFile(sourcePath)).digest('hex'),beforeHash,'Applying overlays must not write the source PDF.');
  assert.equal(await page.locator('.assistant-message.user').count(),0,'The automatic PDF prompt must stay hidden in chat.');
  await toolbar.getByRole('button',{name:'Clear highlights',exact:true}).click();
  await expect(page.locator('.pdf-keyword-highlight')).toHaveCount(0);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('still.pdf-highlights.v1.'))),false);
  await toolbar.getByRole('button',{name:'Detect numbers',exact:true}).click();
  const tokens=page.locator('.pdf-number-token');
  await expect(tokens).toHaveCount(2);
  assert.match(await tokens.first().evaluate(element=>getComputedStyle(element).boxShadow),/inset/,'Detected numbers must have a visible underline.');
  await tokens.nth(0).click();
  await tokens.nth(1).click({modifiers:['Control']});
  await expect(page.locator('.pdf-number-token.is-selected')).toHaveCount(2);
  const firstBox=await tokens.nth(0).boundingBox();
  assert(firstBox);
  const start={x:firstBox.x+firstBox.width/2,y:firstBox.y+firstBox.height/2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down({button:'right'});
  await page.mouse.move(start.x+44,start.y);
  await expect(page.locator('.pdf-operation-wheel .is-active')).toHaveAttribute('aria-label','Addition');
  await page.mouse.up({button:'right'});
  const calculation=page.locator('.widget-calculation .pdf-calculation-widget');
  await expect(calculation).toBeVisible();
  await expect(calculation.locator('output')).toHaveText('15.5');
  await page.waitForFunction(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('still-workspace-v2')||'{}');
      return saved.workspaces?.find(workspace=>workspace.id===saved.activeId)?.widgets.some(widget=>widget.type==='calculation')??false;
    }catch{return false}
  });
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')||'{}'));
  const created=saved.workspaces.find(workspace=>workspace.id===saved.activeId)?.widgets.find(widget=>widget.type==='calculation');
  assert(created,'The wheel should persist a dedicated Calculation widget.');
  assert.deepEqual(JSON.parse(created.text),{values:[12,3.5],operation:'+'});
  await page.reload({waitUntil:'commit'});
  await expect(page.locator('.widget-calculation .pdf-calculation-widget output')).toHaveText('15.5');
  assert.equal(createHash('sha256').update(await readFile(sourcePath)).digest('hex'),beforeHash,'Number selection and calculation must not write the source PDF.');
}

async function runFilesViewers(page) {
  const card=page.locator('.widget-files').filter({hasText:'Fixture Course Files'});
  await expect(card.getByRole('button',{name:'Preview file ~$33333.docx'})).toBeVisible();
  await card.getByRole('button',{name:'Preview file ~$33333.docx'}).click();
  await expect(card.getByText('This is a temporary Office lock file. Open 33333.docx instead.',{exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:'Open matching document in default app'})).toBeVisible();
  await expect(card.getByRole('button',{name:'Open with another app…'})).toHaveCount(0);
  await card.getByRole('button',{name:'Open matching document in default app'}).click();
  await expect(page.getByText('Opened in your default app: 33333.docx',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Back to files'}).click();
  await card.getByRole('button',{name:'Preview file 33333.docx'}).click();
  await expect(card.getByRole('button',{name:'Open default app'})).toBeVisible();
  await expect(card.getByRole('button',{name:'Open with another app…'})).toBeVisible();
  await expect(card.getByText('Still cannot preview this file type here. Use one of the viewer options above.',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Back to files'}).click();
  await card.getByRole('button',{name:'Preview file ~$missing.docx'}).click();
  await expect(card.getByText('This is a temporary Office lock file, and its matching document is not in this folder.',{exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:'Open default app'})).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Open with another app…'})).toHaveCount(0);
}

async function runInbox(page,port) {
  const review=await submit(page);
  await expect(review).toBeVisible();
  await assertUnmoved('first.md');
  await assertUnmoved('second.md');
  await review.click();
  if(mode==='stale'){
    await page.waitForFunction(()=>window.__fixtureSecondHeld===true);
    await assertMoved('first.md');
    await writeFile(join(inbox,'second.md'),'Changed after review.\n');
    await page.evaluate(()=>window.__fixtureReleaseSecond());
  }
  if(mode==='restart'||mode==='revoke') {
    await page.waitForFunction(()=>window.__fixtureSecondHeld===true);
    await assertMoved('first.md');
    await assertUnmoved('second.md');
    assert.equal(await countCalendar(page),0);
    process.kill(bindings.get(page));
    await waitFor(()=>processForPath().length===0,'fixture process exit');
    await waitFor(async()=>!(await get('http://127.0.0.1:'+port+'/json/version')),'old WebView shutdown');
    if(mode==='revoke') {
      const alternate=join(fixture,'Replacement grant');
      await mkdir(alternate);
      await setGrant(alternate);
    }
    page=await openNative(port);
    await installProviderStub(page,true);
    await page.goto(url,{waitUntil:'commit'});
    await openAssistant(page);
    const recovery=page.getByTestId('assistant-recovered-operations');
    await expect(recovery).toBeVisible();
    await expect(recovery).toContainText('first.md');
    await expect(recovery).toContainText('second.md');
    await expect(recovery).toContainText(/fresh (review|inspection)|review again/i);
    const first=recovery.getByRole('listitem').filter({hasText:'first.md'});
    const second=recovery.getByRole('listitem').filter({hasText:'second.md'});
    await expect(first).toContainText('Filed/first.md');
    await expect(first).toContainText(/verified when moved|verified complete/i);
    if(mode==='revoke')await expect(second).toContainText(/outcome unclear|changed|unavailable|cannot verify/i);
    else await expect(second).toContainText(/not moved|not attempted/i);
    await expect(page.getByRole('button',{name:'Move file (2)',exact:true})).toHaveCount(0);
    await assertMoved('first.md');
    await assertUnmoved('second.md');
    assert.equal(await countCalendar(page),0);
    if(mode==='restart'){
      await page.locator('#ai-message').fill('Move second.md to Filed in Downloads Inbox.');
      await page.locator('.assistant-compose').evaluate(form=>form.requestSubmit());
      const fresh=page.getByRole('button',{name:'Move file (1)',exact:true});
      await expect(fresh).toBeVisible();
      await assertUnmoved('second.md');
      await fresh.click();
      await expect(page.getByText('Fixture recovery follow-up complete.',{exact:true})).toBeVisible();
      await assertMoved('first.md');
      await assertMoved('second.md');
      assert.equal(await countCalendar(page),0);
    }
  } else {
    if(mode==='timeout'){
      await expect(page.getByText('Synthetic provider timeout after native receipt.',{exact:true})).toBeVisible();
      await expect(page.locator('.assistant-log')).toContainText('2 of 2 file moves verified.');
    }
    else await expect(page.getByRole('button',{name:'Approve and add widget',exact:true})).toBeVisible();
    await assertMoved('first.md');
    if(mode==='stale'){
      await assertUnmoved('second.md');
      assert.equal(await readFile(join(inbox,'second.md'),'utf8'),'Changed after review.\n');
    }else await assertMoved('second.md');
    const receipt=await page.evaluate(()=>JSON.parse(window.__fixtureTurns[2].messages.at(-1).content));
    assert.equal(receipt.mutation,mode==='stale'?'unknown':'applied');
    if(mode==='stale')assert.match(receipt.error,/1 of 2 file moves verified/);
    assert.match(JSON.stringify(receipt),/Filed\/first\.md/);
    if(mode==='success') {
      await page.getByRole('button',{name:'Approve and add widget',exact:true}).click();
      await expect(page.getByText('Fixture workflow complete.',{exact:true})).toBeVisible();
      await expect.poll(()=>countCalendar(page)).toBe(1);
    } else assert.equal(await countCalendar(page),0);
  }
}

try {
  assert.equal(processForPath().length,0,'Close Still using the fixture executable path before running this test.');
  const vitePort=await reservePort(0);
  url='http://127.0.0.1:'+vitePort+'/design-preview.html';
  const port=await reservePort(0);
  await mkdir(join(inbox,'Filed'),{recursive:true});
  await mkdir(grants,{recursive:false});
  if(pdfCase){await mkdir(pdfRoot);await writeFile(join(pdfRoot,'Lecture.pdf'),textPdf('Mitochondria produce ATP. Values 12 and 3.5.'));}
  await setGrant(inbox);
  if(libraryCase){
    await mkdir(notesRoot);
    await writeFile(join(notesRoot,'lesson.md'),'Original study note.\n');
  }
  for(const name of files)await writeFile(join(inbox,name),'Synthetic '+name+'\n');
  if(filesViewerCase){
    await writeFile(join(inbox,'33333.docx'),'Synthetic document for native default-app integration.');
    await writeFile(join(inbox,'~$33333.docx'),'Office temporary lock stub.');
    await writeFile(join(inbox,'~$missing.docx'),'Orphan Office temporary lock stub.');
  }
  await writeFile(config,JSON.stringify({identifier,build:{beforeDevCommand:'',devUrl:url},app:{windows:[{label:'main',title,url:bootstrapPath.slice(1),width:1360,height:960,transparent:true,devtools:true}]}}));
  const viteConfig=join(fixture,'vite.config.mjs');
  await writeFile(viteConfig,`import base from ${JSON.stringify(new URL('../../vite.config.ts',import.meta.url).href)};
const bootstrap={name:'fixture-bootstrap',configureServer(server){server.middlewares.use(${JSON.stringify(bootstrapPath)},(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Still test bootstrap</title>');});}};
export default {...base,plugins:[...base.plugins,bootstrap],server:{...base.server,watch:{ignored:'**/src-tauri/target/**'}}};\n`);
  start('node_modules/vite/bin/vite.js',['--config',viteConfig,'--host','127.0.0.1','--port',String(vitePort),'--strictPort']);
  await waitFor(()=>get(url),'fixture Vite frontend');
  const page=await openNative(port);
  await installProviderStub(page);
  await seed(page);
  await assertGrant(page,inbox);
  if(mode==='theme'||geometry)await runControl(page);
  else if(libraryCase)await runLibrary(page);
  else if(pdfCase)await runPdfHighlights(page);
  else if(filesViewerCase)await runFilesViewers(page);
  else await runInbox(page,port);
  console.log('Native Still fixture passed: '+mode);
} catch(error) {
  console.error(error.message);
  if(fixturePage&&!fixturePage.isClosed()){
    const details=await fixturePage.locator('.assistant-error').allTextContents().catch(()=>[]);
    if(details.length)console.error('Fixture assistant:',details.join('\n'));
    const body=await fixturePage.locator('body').innerText().catch(()=> '');
    if(body)console.error('Fixture page:',body.slice(0,5000));
  }
  console.error(runOutput.join('').slice(-7000));
  process.exitCode=1;
} finally {
  // Kill only the process with this fixture's random title and exact executable path.
  try { stopFixture(); }
  finally { for(const child of children)child.kill(); }
}
