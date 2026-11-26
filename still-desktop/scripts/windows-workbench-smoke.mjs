#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,rm,writeFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
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
function errorText(error){return error instanceof Error?`${error.name}: ${error.message}\n${error.stack??''}`:String(error)}
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
function addCheck(checks,name,status,details){checks.push({name,status,...details})}

async function main(){
 const options=parseArgs(process.argv.slice(2));
 const reportPath=path.join(options.artifactDir,'windows-workbench-smoke.json');
 const screenshotPath=path.join(options.artifactDir,'still-main-before-hide.png');
 const report={schemaVersion:1,startedAt:new Date().toISOString(),runner:{platform:process.platform,githubActions:process.env.GITHUB_ACTIONS??null,ci:process.env.CI??null},candidate:{path:options.exe,sha256:null},cdp:{port:options.port,url:`http://127.0.0.1:${options.port}`},checks:[],artifacts:{report:reportPath,screenshot:null},process:{pid:null,stdoutTail:'',stderrTail:''}};
 let appProcess=null,browser=null,page=null,listenerId=null,browserPanelCreated=false,smokeProfile=null,failed=false,currentCheck='preflight',failure=null;
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

  smokeProfile=await mkdtemp(path.join(tmpdir(),'still-workbench-smoke-'));
  const localAppData=path.join(smokeProfile,'LocalAppData'),roamingAppData=path.join(smokeProfile,'RoamingAppData');
  await mkdir(localAppData,{recursive:true});await mkdir(roamingAppData,{recursive:true});
  const env={...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${options.port}`,LOCALAPPDATA:localAppData,APPDATA:roamingAppData};
  appProcess=spawn(options.exe,[],{cwd:path.dirname(options.exe),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  report.process.pid=appProcess.pid??null;
  appProcess.stdout?.on('data',chunk=>{report.process.stdoutTail=(report.process.stdoutTail+chunk.toString()).slice(-24_000)});
  appProcess.stderr?.on('data',chunk=>{report.process.stderrTail=(report.process.stderrTail+chunk.toString()).slice(-24_000)});
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
   const fullscreen=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|is_fullscreen',{label:'main'}));
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

  await check('hidden-window-native-tick-delivery',async()=>{
   listenerId=await page.evaluate(async()=>{
    window.__stillSmokeTicks=[];
    const callback=window.__TAURI_INTERNALS__.transformCallback(tick=>window.__stillSmokeTicks.push(tick));
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
   return{before:{latestSequence:before.latestSequence,visible:before.mainWindowVisible},hidden:{hiddenToTray:hidden.hiddenToTray,visible:hidden.mainWindowVisible},after:{latestSequence:after.latestSequence,visible:after.mainWindowVisible},hiddenPageDelivered:delivered};
  });
 }catch(error){
  failed=true;failure={check:currentCheck,error:errorText(error)};
  if(!checks.some(item=>item.name===currentCheck&&item.status==='failed'))addCheck(checks,currentCheck,'failed',{error:errorText(error)});
  console.error(`Windows workbench smoke failed at ${currentCheck}:\n${errorText(error)}`);
 }finally{
  if(page&&browserPanelCreated){try{await page.evaluate(widgetId=>window.__TAURI_INTERNALS__.invoke('browser_panel_close',{widgetId}),BROWSER_WIDGET_ID)}catch(error){report.cleanupBrowserPanelError=errorText(error)}}
  if(page&&listenerId!==null){try{await page.evaluate(eventId=>window.__TAURI_INTERNALS__.invoke('plugin:event|unlisten',{event:'still:automation-tick',eventId}),listenerId)}catch(error){report.cleanupListenerError=errorText(error)}}
  if(browser){try{await browser.close()}catch(error){report.cdpDisconnectError=errorText(error)}}
  if(appProcess){await killProcessTree(appProcess);report.process.exitCode=appProcess.exitCode}
  if(smokeProfile){try{await rm(smokeProfile,{recursive:true,force:true})}catch(error){report.cleanupProfileError=errorText(error)}}
  report.finishedAt=new Date().toISOString();report.result=failed?'failed':'passed';report.failure=failure;
  await mkdir(options.artifactDir,{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`Smoke report: ${reportPath}`);if(report.artifacts.screenshot)console.log(`Screenshot: ${report.artifacts.screenshot}`);
 }
 if(failed)process.exitCode=1;
}

main().catch(error=>{console.error(errorText(error));process.exitCode=1});
