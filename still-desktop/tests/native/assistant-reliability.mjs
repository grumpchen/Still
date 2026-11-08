// Opt-in Windows integration test. Run from still-desktop with node --import tsx.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
assert(['success','stale','timeout','restart','revoke','theme','move-widget','resize-widget','library-edit','library-conflict'].includes(mode), 'Specify an acceptance case from tests/native/README.md.');
const libraryCase = mode.startsWith('library-');
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
const grants = join(process.env.APPDATA, identifier);
const grantFile = join(grants, 'file-folders.json');
const config = join(fixture, 'tauri.json');
const url = 'http://127.0.0.1:4318/design-preview.html';
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
if(libraryCase||geometry){
  notes.title='Fixture Notes';
  if(libraryCase){notes.notesLibraryKey=notes.id;notes.notesLibraryName='Fixture Notes Library';}
  canvas.widgets.push(notes);
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
  await writeFile(grantFile,JSON.stringify({'still-downloads-inbox':path,[downloads.id]:path,...(libraryCase?{[notes.id]:notesRoot}:{})}),'utf8');
}

async function openNative(port) {
  start('scripts/dev-desktop.mjs',['--no-watch','--config',config],{
    CARGO_TARGET_DIR:cargoTarget,WEBVIEW2_USER_DATA_FOLDER:profile,
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
  const lesson=join(notesRoot,'lesson.md');
  await openAssistant(page);
  await page.locator('#ai-message').fill('@Notes Search my Notes Library for lesson, read lesson.md, then edit lesson.md to say Revised study note.');
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
  await reservePort(4318);
  const port=await reservePort(0);
  await mkdir(join(inbox,'Filed'),{recursive:true});
  await mkdir(grants,{recursive:false});
  await setGrant(inbox);
  if(libraryCase){
    await mkdir(notesRoot);
    await writeFile(join(notesRoot,'lesson.md'),'Original study note.\n');
  }
  for(const name of files)await writeFile(join(inbox,name),'Synthetic '+name+'\n');
  await writeFile(config,JSON.stringify({identifier,build:{beforeDevCommand:''},app:{windows:[{label:'main',title,url:bootstrapPath.slice(1),width:1360,height:960,transparent:true,devtools:true}]}}));
  const viteConfig=join(fixture,'vite.config.mjs');
  await writeFile(viteConfig,`import base from ${JSON.stringify(new URL('../../vite.config.ts',import.meta.url).href)};
const bootstrap={name:'fixture-bootstrap',configureServer(server){server.middlewares.use(${JSON.stringify(bootstrapPath)},(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Still test bootstrap</title>');});}};
export default {...base,plugins:[...base.plugins,bootstrap],server:{...base.server,watch:{ignored:'**/src-tauri/target/**'}}};\n`);
  start('node_modules/vite/bin/vite.js',['--config',viteConfig,'--host','127.0.0.1','--port','4318','--strictPort']);
  await waitFor(()=>get(url),'fixture Vite frontend');
  const page=await openNative(port);
  await installProviderStub(page);
  await seed(page);
  await assertGrant(page,inbox);
  if(mode==='theme'||geometry)await runControl(page);
  else if(libraryCase)await runLibrary(page);
  else await runInbox(page,port);
  console.log('Native Still fixture passed: '+mode);
} catch(error) {
  console.error(error.message);
  if(fixturePage&&!fixturePage.isClosed()){
    const details=await fixturePage.locator('.assistant-error').allTextContents().catch(()=>[]);
    if(details.length)console.error('Fixture assistant:',details.join('\n'));
  }
  console.error(runOutput.join('').slice(-7000));
  process.exitCode=1;
} finally {
  // Kill only the process with this fixture's random title and exact executable path.
  try { stopFixture(); }
  finally { for(const child of children)child.kill(); }
}
