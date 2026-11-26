#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {chromium} from '@playwright/test';

const execFileAsync=promisify(execFile);
const DEFAULT_PORT=9222;
const MAX_STARTUP_MS=45_000;
const POLL_MS=400;
const TICK_WAIT_MAX_MS=30_000;
const BROWSER_WIDGET_ID='smoke-browser';
const MAX_CAPTURED_PROCESS_LOG=6_000;

function parseArgs(argv){
 const args={};
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--exe'||argv[i]==='--artifact-dir'||argv[i]==='--port'){
   const key=argv[i].slice(2).replaceAll('-','');const value=argv[++i];
   if(!value)throw new Error(`Missing value for ${argv[i-1]}`);args[key]=value;
  }else throw new Error(`Unknown argument: ${argv[i]}`);
 }
 if(!args.exe)throw new Error('Pass the candidate release executable with --exe <path>.');
 if(!args.artifactdir)throw new Error('Pass the artifact output directory with --artifact-dir <path>.');
 args.port=args.port?Number(args.port):DEFAULT_PORT;
 if(!Number.isSafeInteger(args.port)||args.port<1024||args.port>65535)throw new Error('--port must be an integer from 1024 through 65535.');
 return{exe:path.resolve(args.exe),artifactDir:path.resolve(args.artifactdir),port:args.port};
}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function redactDiagnostic(value){return String(value).replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization)\b\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]').replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,'Bearer [REDACTED]')}
function errorText(error,depth=0){
 if(!(error instanceof Error))return redactDiagnostic(error);
 const details=[`${error.name}: ${error.message}`];if(error.code)details.push(`code=${error.code}`);if(error.cause&&depth<3)details.push(`caused by ${errorText(error.cause,depth+1)}`);
 if(Array.isArray(error.errors)&&depth<2)details.push(`aggregate=[${error.errors.slice(0,4).map(item=>errorText(item,depth+1)).join(' | ')}]`);
 if(depth===0&&error.stack)details.push(error.stack);
 return redactDiagnostic(details.join('\n'));
}
function appendLogTail(previous,chunk){return redactDiagnostic(previous+chunk.toString()).slice(-MAX_CAPTURED_PROCESS_LOG)}
async function sha256File(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex')}
async function fetchJson(url,timeoutMs=2_500){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);return await response.json()}
 finally{clearTimeout(timer)}
}
async function pollUntil(label,operation,timeoutMs){
 const deadline=Date.now()+timeoutMs;let lastError='not attempted';
 while(Date.now()<deadline){
  try{const result=await operation();if(result)return result;lastError=`${label} condition was not met yet`}
  catch(error){lastError=errorText(error)}
  await delay(POLL_MS);
 }
 throw new Error(`${label} timed out after ${timeoutMs}ms. Last observation: ${lastError}`);
}
async function killProcessTree(child){
 if(!child?.pid||child.exitCode!==null)return;
 if(process.platform==='win32'){
  try{await execFileAsync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{timeout:8_000,windowsHide:true,stdio:'ignore'})}catch{/* Fall through to the direct process handle. */}
 }
 if(child.exitCode===null)try{child.kill('SIGKILL')}catch{}
 if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5_000)]);
}
async function getWindowsProcessTree(rootPid,port){
 const script=`$rootPid=${Number(rootPid)}; $port=${Number(port)}; $all=@(Get-CimInstance Win32_Process); $ids=New-Object 'System.Collections.Generic.HashSet[long]'; $null=$ids.Add([long]$rootPid); $changed=$true; while($changed){$changed=$false; foreach($p in $all){if($ids.Contains([long]$p.ParentProcessId) -and $ids.Add([long]$p.ProcessId)){$changed=$true}}}; $rows=@(foreach($p in $all){if($ids.Contains([long]$p.ProcessId)){$gp=Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue; $handle='0x0'; $title=''; if($gp){$handle='0x{0:X}' -f $gp.MainWindowHandle.ToInt64(); $title=$gp.MainWindowTitle}; $cmd=[string]$p.CommandLine; [pscustomobject]@{pid=[long]$p.ProcessId;parentPid=[long]$p.ParentProcessId;name=[string]$p.Name;executablePath=[string]$p.ExecutablePath;mainWindowHandle=$handle;mainWindowTitle=$title;hasRemoteDebuggingPort=($cmd -match ('--remote-debugging-port(?:=|\\s+)' + $port));hasUserDataDirArgument=($cmd -match '--user-data-dir(?:=|\\s+)');startedAt=$p.CreationDate}}}); ConvertTo-Json -InputObject $rows -Depth 3 -Compress`;
 const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{timeout:8_000,maxBuffer:200_000,windowsHide:true});
 return JSON.parse(stdout||'[]');
}
function addCheck(checks,name,status,details){checks.push({name,status,...details})}

async function main(){
 const options=parseArgs(process.argv.slice(2));
 const reportPath=path.join(options.artifactDir,'windows-workbench-smoke.json');
 const screenshotPath=path.join(options.artifactDir,'still-main-before-hide.png');
 const report={schemaVersion:1,startedAt:new Date().toISOString(),runner:{platform:process.platform,githubActions:process.env.GITHUB_ACTIONS??null,ci:process.env.CI??null},candidate:{path:options.exe,sha256:null},cdp:{port:options.port,url:`http://127.0.0.1:${options.port}`},checks:[],artifacts:{report:reportPath,screenshot:null},process:{pid:null,stdoutTail:'',stderrTail:''}};
 let appProcess=null,browser=null,page=null,listenerId=null,browserPanelCreated=false,smokeAutomationFixture=null,failed=false,currentCheck='preflight',failure=null;
 const checks=report.checks;
 const check=async(name,fn)=>{currentCheck=name;try{const details=await fn();addCheck(checks,name,'passed',{details:details??null});return details}catch(error){addCheck(checks,name,'failed',{error:errorText(error)});throw error}};
 try{
  await mkdir(options.artifactDir,{recursive:true});
  if(process.platform!=='win32')throw new Error(`This smoke test requires a Windows GitHub runner; current platform is ${process.platform}.`);
  if(process.env.GITHUB_ACTIONS!=='true')throw new Error('Refusing to launch the release outside an isolated GitHub Actions runner.');
  await check('candidate-executable',async()=>{
   const {access}=await import('node:fs/promises');await access(options.exe);
   report.candidate.sha256=await sha256File(options.exe);
   return{path:options.exe,sha256:report.candidate.sha256};
  });
  await check('cdp-port-free',async()=>{
   const server=createServer();
   try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port,'127.0.0.1',()=>server.close(error=>error?reject(error):resolve()))})}
   catch(error){if(error?.code==='EADDRINUSE')throw new Error(`CDP port ${options.port} is occupied; refusing to attach to an unrelated process.`);throw error}
   return{port:options.port,free:true};
  });

  // GitHub runners are disposable; preserve their real Windows app-data paths so
  // WebView2 runtime discovery and Tauri's normal data-directory policy apply.
  // CDP is explicitly opt-in in native startup and accepted only on GitHub Actions.
  const env={...process.env,STILL_TEST_CDP_PORT:String(options.port)};
  report.process.appDataOverridesApplied=false;report.process.webview2UserDataFolderIsolated=false;report.process.requestedRemoteDebuggingPort=options.port;report.process.cdpOptIn='STILL_TEST_CDP_PORT (accepted only when GITHUB_ACTIONS=true)';
  appProcess=spawn(options.exe,[],{cwd:path.dirname(options.exe),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  report.process.pid=appProcess.pid??null;
  appProcess.stdout?.on('data',chunk=>{report.process.stdoutTail=appendLogTail(report.process.stdoutTail,chunk)});
  appProcess.stderr?.on('data',chunk=>{report.process.stderrTail=appendLogTail(report.process.stderrTail,chunk)});
  appProcess.on('error',error=>{report.process.spawnError=errorText(error)});

  await check('webview2-cdp-start',async()=>{
   const version=await pollUntil('WebView2 remote debugging endpoint',async()=>{
    if(appProcess.exitCode!==null||report.process.spawnError)throw new Error(`Still failed before CDP became available (exit ${appProcess.exitCode}). spawn: ${report.process.spawnError??'none'} stdout: ${report.process.stdoutTail}\nstderr: ${report.process.stderrTail}`);
    return await fetchJson(`${report.cdp.url}/json/version`,2_000).catch(error=>{report.cdp.lastProbeError=errorText(error);return null});
   },MAX_STARTUP_MS).catch(error=>{throw new Error(`${errorText(error)}; last raw CDP probe error: ${report.cdp.lastProbeError??'none'}`)});
   report.cdp.browser=version.Browser??null;report.cdp.webSocketDebuggerUrl=version.webSocketDebuggerUrl??null;
   browser=await pollUntil('Playwright CDP connection',async()=>{
    try{return await chromium.connectOverCDP(report.cdp.url,{timeout:3_000})}catch(error){report.cdp.lastConnectError=errorText(error);return null}
   },12_000).catch(error=>{throw new Error(`${errorText(error)}; last raw Playwright CDP error: ${report.cdp.lastConnectError??'none'}`)});
   page=await pollUntil('main design-preview page',async()=>{
    const pages=browser.contexts().flatMap(context=>context.pages());
    report.cdp.discoveredPages=pages.map(candidate=>({url:candidate.url()}));
    const match=pages.find(candidate=>candidate.url().includes('design-preview.html'));
    return match??null;
   },10_000);
   await page.locator('.dashboard-home').waitFor({state:'visible',timeout:15_000});
   await page.screenshot({path:screenshotPath,fullPage:false,animations:'disabled'});
   report.artifacts.screenshot=screenshotPath;
   return{browser:report.cdp.browser,pageUrl:page.url(),pageTitle:await page.title(),screenshot:screenshotPath};
  });

  await check('dashboard-ui-and-fullscreen',async()=>{
   const state=await page.evaluate(()=>{
    const stored=localStorage.getItem('still-workspace-v2');
    let workspace=null;try{workspace=stored?JSON.parse(stored):null}catch{}
    const dashboard=workspace?.workspaces?.find(item=>item.role==='dashboard');
    const activeWorkspace=document.querySelector('.nav button[aria-current="page"]')?.getAttribute('aria-label')??'';
    const dashboardSurface=document.querySelector('.dashboard-home')?.closest('.workspace-surface');
    return{version:workspace?.version??null,activeId:workspace?.activeId??null,dashboardId:dashboard?.id??null,activeWorkspace,dashboardElement:!!document.querySelector('.dashboard-home'),dashboardSurfaceVisible:!!dashboardSurface&&!dashboardSurface.hidden,title:document.title};
   });
   const activeDashboard=state.dashboardId?state.activeId===state.dashboardId:/dashboard/i.test(state.activeWorkspace);
   if(!activeDashboard||!state.dashboardElement||!state.dashboardSurfaceVisible)throw new Error(`Dashboard was not the active rendered workspace. Observed app state: ${JSON.stringify(state)}`);
   const fullscreen=await pollUntil('native fullscreen startup',async()=>await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|is_fullscreen',{label:'main'})),10_000);
   if(fullscreen!==true)throw new Error(`Dashboard startup did not result in a fullscreen native window. is_fullscreen=${JSON.stringify(fullscreen)}`);
   return{...state,fullscreen,screenshot:screenshotPath};
  });

  const mainWindowStatus=await check('native-runtime-status',async()=>{
   const status=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('automation_runtime_status',{}));
   if(!status?.runtimeId||typeof status.latestSequence!=='number')throw new Error(`Unexpected automation runtime status: ${JSON.stringify(status)}`);
   return status;
  });

  await check('embedded-browser-create-navigate-close',async()=>{
   const bounds={x:24,y:120,width:600,height:400};
   await page.evaluate(async({widgetId,url,bounds})=>window.__TAURI_INTERNALS__.invoke('browser_panel_present',{widgetId,url,bounds,visible:true}),{widgetId:BROWSER_WIDGET_ID,url:'https://example.com/',bounds});
   browserPanelCreated=true;
   const firstTarget=await pollUntil('embedded Browser WebView2 target after present',async()=>{
    const targets=await fetchJson(`${report.cdp.url}/json/list`);
    return targets.find(target=>target.type==='page'&&target.url.startsWith('https://example.com/'))??null;
   },10_000);
   await page.evaluate(async({widgetId,url})=>window.__TAURI_INTERNALS__.invoke('browser_panel_navigate',{widgetId,url}),{widgetId:BROWSER_WIDGET_ID,url:'https://example.org/'});
   const navigatedTarget=await pollUntil('embedded Browser target after navigate',async()=>{
    const targets=await fetchJson(`${report.cdp.url}/json/list`);
    return targets.find(target=>target.type==='page'&&target.url.startsWith('https://example.org/'))??null;
   },10_000);
   await page.evaluate(async widgetId=>window.__TAURI_INTERNALS__.invoke('browser_panel_close',{widgetId}),BROWSER_WIDGET_ID);
   browserPanelCreated=false;
   await pollUntil('embedded Browser target removal after close',async()=>{
    const targets=await fetchJson(`${report.cdp.url}/json/list`);
    return targets.some(target=>target.type==='page'&&(target.url.startsWith('https://example.com/')||target.url.startsWith('https://example.org/')))?null:true;
   },10_000);
   return{presentTarget:{id:firstTarget.id,url:firstTarget.url},navigatedTarget:{id:navigatedTarget.id,url:navigatedTarget.url},closed:true};
  });

  await check('create-tray-layout-rule-through-ui',async()=>{
   await page.evaluate(()=>localStorage.setItem('still-first-run-tutorial-v1','done'));
   const startupDialog=page.locator('dialog[open]');
   if(await startupDialog.count())await startupDialog.getByRole('button',{name:'Close dialog'}).click();
   const suffix=Date.now().toString(36),layoutName=`Smoke ${suffix}`;
   await page.locator('.dashboard-hero-actions').getByRole('button',{name:'Layouts',exact:true}).click();
   const layoutDialog=page.getByRole('dialog',{name:'Layouts'});
   await layoutDialog.getByLabel('Global layout name').fill(layoutName);
   await layoutDialog.getByLabel('Source workspace').selectOption({label:'Design'});
   await layoutDialog.getByRole('button',{name:'Save complete layout'}).click();
   const savedLayout=await pollUntil('smoke layout persistence',async()=>await page.evaluate(name=>{
    const state=JSON.parse(localStorage.getItem('still-workspace-v2')||'null');return state?.globalLayouts?.find(layout=>layout.name===name)??null;
   },layoutName),10_000);
   if(!savedLayout.widgets.length)throw new Error('The saved fixture layout has no widgets, so it cannot prove a layout change.');
   const appState=await page.evaluate(()=>JSON.parse(localStorage.getItem('still-workspace-v2')||'null'));
   if(!appState?.workspaces||!Array.isArray(appState.globalLayouts))throw new Error('The candidate app did not persist its workspace state after the UI saved a layout.');
   const target=appState.workspaces.find(workspace=>workspace.name==='Study');
   if(!target)throw new Error(`Smoke fixture requires the default Study workspace; found ${appState.workspaces.map(workspace=>workspace.name).join(', ')}`);
   const targetWidgetIds=target.widgets.map(widget=>widget.id).sort();
   await layoutDialog.locator('.dashboard-layout-close').click();

   await page.getByRole('button',{name:'Rules',exact:true}).click();
   const ruleDialog=page.getByRole('dialog',{name:/Rules/});
   const dueAt=new Date(Date.now()-30_000).toISOString().replace(/\.\d{3}Z$/,'Z');
   const ruleText=`At ${dueAt} replace Study workspace with ${layoutName} layout`;
   await ruleDialog.getByLabel('Create a rule in one sentence').fill(ruleText);
   await ruleDialog.getByRole('button',{name:'Save rule',exact:true}).click();
   const rule=await pollUntil('one-time rule persistence',async()=>await page.evaluate(text=>{
    const state=JSON.parse(localStorage.getItem('still.automation-rules.v2')||'null');return state?.rules?.find(item=>item.sourceText===text)??null;
   },ruleText),10_000);
   if(rule.trigger.kind!=='once'||rule.action.kind!=='prepareWorkspaceLayout'||rule.action.mode!=='replace')throw new Error(`The UI saved an unexpected rule shape: ${JSON.stringify(rule)}`);
   smokeAutomationFixture={ruleId:rule.id,targetId:target.id,layoutId:savedLayout.id,layoutName,ruleText,beforeWidgetIds:targetWidgetIds,expectedTypes:savedLayout.widgets.map(widget=>widget.type).sort()};
   return{ruleId:rule.id,trigger:rule.trigger,action:rule.action,targetName:target.name,beforeWidgetIds:targetWidgetIds,savedLayout:{id:savedLayout.id,name:savedLayout.name,widgetTypes:smokeAutomationFixture.expectedTypes}};
  });

  await check('hidden-window-native-tick-delivery',async()=>{
   listenerId=await page.evaluate(async()=>{
    window.__stillSmokeTicks=[];
    const callback=window.__TAURI_INTERNALS__.transformCallback(event=>window.__stillSmokeTicks.push(event.payload));
    const eventId=await window.__TAURI_INTERNALS__.invoke('plugin:event|listen',{event:'still:automation-tick',target:{kind:'Any'},handler:callback});
    window.__stillSmokeTickEventId=eventId;return eventId;
   });
   const before=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('automation_runtime_status',{}));
   if(!before.trayAvailable)throw new Error(`Native tray is unavailable, so hide could not be tested: ${before.trayError??'unknown reason'}`);
   await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('window_minimize_to_tray',{}));
   const hidden=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('automation_runtime_status',{}));
   if(hidden.hiddenToTray!==true||hidden.mainWindowVisible!==false)throw new Error(`Window did not hide to tray: ${JSON.stringify(hidden)}`);
   const waitMs=Math.min(TICK_WAIT_MAX_MS,Math.max(20_000,(before.tickIntervalMs??15_000)+8_000));
   await page.waitForFunction(sequence=>window.__stillSmokeTicks?.some(tick=>tick.sequence>sequence),before.latestSequence,{timeout:waitMs,polling:500}).catch(error=>{throw new Error(`No native tick callback reached the hidden page within ${waitMs}ms; ${errorText(error)}`)});
   const after=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('automation_runtime_status',{}));
   const delivered=await page.evaluate(sequence=>window.__stillSmokeTicks.filter(tick=>tick.sequence>sequence),before.latestSequence);
   if(after.latestSequence<=before.latestSequence)throw new Error(`Native tick sequence did not increase: before=${before.latestSequence}, after=${after.latestSequence}`);
   if(!delivered.length)throw new Error(`Native status advanced to ${after.latestSequence}, but hidden-page callback had no newer tick.`);
   if(!smokeAutomationFixture)throw new Error('The one-time layout rule fixture was not created.');
   const firstTickSequence=Math.min(...delivered.map(tick=>tick.sequence));
   const applied=await pollUntil('once-rule receipt and workspace change while hidden',async()=>await page.evaluate(({ruleId,targetId,layoutId,beforeWidgetIds,expectedTypes})=>{
    const rules=JSON.parse(localStorage.getItem('still.automation-rules.v2')||'null'),app=JSON.parse(localStorage.getItem('still-workspace-v2')||'null');
    const rule=rules?.rules?.find(item=>item.id===ruleId),receipt=rules?.receipts?.find(item=>item.ruleId===ruleId&&item.status==='succeeded');
    const target=app?.workspaces?.find(item=>item.id===targetId),layout=app?.globalLayouts?.find(item=>item.id===layoutId);
    if(!rule||!receipt||!target||!layout)return null;
    const widgetIds=target.widgets.map(widget=>widget.id).sort(),widgetTypes=target.widgets.map(widget=>widget.type).sort();
    if(JSON.stringify(widgetIds)===JSON.stringify(beforeWidgetIds)||JSON.stringify(widgetTypes)!==JSON.stringify(expectedTypes))return null;
    return{rule,receipt,workspace:{id:target.id,name:target.name,widgetIds,widgetTypes},layout:{id:layout.id,name:layout.name,widgetTypes:layout.widgets.map(widget=>widget.type).sort()}};
   },smokeAutomationFixture),20_000);
   if(applied.rule.onceTerminal?.status!=='succeeded')throw new Error(`The one-time rule did not record a successful terminal result: ${JSON.stringify(applied.rule.onceTerminal)}`);
   const firstAppliedSequence=after.latestSequence;
   await page.waitForFunction(sequence=>window.__stillSmokeTicks?.some(tick=>tick.sequence>sequence),firstAppliedSequence,{timeout:Math.min(TICK_WAIT_MAX_MS,Math.max(20_000,(before.tickIntervalMs??15_000)+8_000)),polling:500});
   const dedupe=await page.evaluate(({ruleId,targetId,beforeWidgetIds,expectedTypes})=>{
    const rules=JSON.parse(localStorage.getItem('still.automation-rules.v2')||'null'),app=JSON.parse(localStorage.getItem('still-workspace-v2')||'null');
    const rule=rules?.rules?.find(item=>item.id===ruleId),receipts=rules?.receipts?.filter(item=>item.ruleId===ruleId)??[],target=app?.workspaces?.find(item=>item.id===targetId);
    return{rule,receiptCount:receipts.length,receipts,widgetIds:target?.widgets?.map(widget=>widget.id).sort()??[],widgetTypes:target?.widgets?.map(widget=>widget.type).sort()??[],beforeWidgetIds,expectedTypes};
   },smokeAutomationFixture);
   if(dedupe.rule?.onceTerminal?.status!=='succeeded'||dedupe.receiptCount!==1||JSON.stringify(dedupe.widgetTypes)!==JSON.stringify(dedupe.expectedTypes)||JSON.stringify(dedupe.widgetIds)===JSON.stringify(dedupe.beforeWidgetIds)||JSON.stringify(dedupe.widgetIds)!==JSON.stringify(applied.workspace.widgetIds))throw new Error(`The completed once rule changed again or duplicated its receipt on a later hidden tick: ${JSON.stringify(dedupe)}`);
   return{before:{latestSequence:before.latestSequence,visible:before.mainWindowVisible},hidden:{hiddenToTray:hidden.hiddenToTray,visible:hidden.mainWindowVisible},after:{latestSequence:after.latestSequence,visible:after.mainWindowVisible},hiddenPageDelivered:delivered,ruleExecution:{ruleId:smokeAutomationFixture.ruleId,receipt:applied.receipt,workspaceBeforeWidgetIds:smokeAutomationFixture.beforeWidgetIds,workspaceAfterWidgetIds:applied.workspace.widgetIds,layoutWidgetTypes:applied.layout.widgetTypes,workspaceWidgetTypes:applied.workspace.widgetTypes},dedupeAfterLaterTick:{receiptCount:dedupe.receiptCount,widgetIdsUnchanged:true,terminalStatus:dedupe.rule.onceTerminal.status}};
  });
 }catch(error){
  failed=true;failure={check:currentCheck,error:errorText(error)};
  if(appProcess?.pid&&process.platform==='win32'){
   try{report.process.windows=await getWindowsProcessTree(appProcess.pid,options.port)}
   catch(diagnosticError){report.process.windowsDiagnosticError=errorText(diagnosticError)}
  }
  if(!checks.some(item=>item.name===currentCheck&&item.status==='failed'))addCheck(checks,currentCheck,'failed',{error:errorText(error)});
  console.error(`Windows workbench smoke failed at ${currentCheck}:\n${errorText(error)}`);
 }finally{
  if(page&&browserPanelCreated){try{await page.evaluate(widgetId=>window.__TAURI_INTERNALS__.invoke('browser_panel_close',{widgetId}),BROWSER_WIDGET_ID)}catch(error){report.cleanupBrowserPanelError=errorText(error)}}
  if(page&&listenerId!==null){try{await page.evaluate(eventId=>window.__TAURI_INTERNALS__.invoke('plugin:event|unlisten',{event:'still:automation-tick',eventId}),listenerId)}catch(error){report.cleanupListenerError=errorText(error)}}
  if(browser){try{await browser.close()}catch(error){report.cdpDisconnectError=errorText(error)}}
  if(appProcess){await killProcessTree(appProcess);report.process.exitCode=appProcess.exitCode}
  report.finishedAt=new Date().toISOString();report.result=failed?'failed':'passed';report.failure=failure;
  await mkdir(options.artifactDir,{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`Smoke report: ${reportPath}`);if(report.artifacts.screenshot)console.log(`Screenshot: ${report.artifacts.screenshot}`);
  console.log('Windows smoke diagnostic summary:\n'+JSON.stringify({result:report.result,failure:report.failure,cdp:{port:report.cdp.port,lastProbeError:report.cdp.lastProbeError,lastConnectError:report.cdp.lastConnectError},process:{pid:report.process.pid,exitCode:report.process.exitCode,spawnError:report.process.spawnError,windows:report.process.windows,windowsDiagnosticError:report.process.windowsDiagnosticError,stdoutTail:report.process.stdoutTail.slice(-1800),stderrTail:report.process.stderrTail.slice(-1800)}},null,2));
 }
 if(failed)process.exitCode=1;
}

main().catch(error=>{console.error(errorText(error));process.exitCode=1});
