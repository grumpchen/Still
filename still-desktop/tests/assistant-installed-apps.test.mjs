import test from 'node:test';
import assert from 'node:assert/strict';
import {installedAppRequest,matchInstalledApp} from '../src/domain/assistantInstalledApps.ts';

test('installed app commands resolve names and aliases without interpreting paths or arguments',()=>{
 const installed=['Google Chrome Beta','Google Chrome','Chrome - Work'].map(name=>({id:name,name,icon:[]}));
 const request=installedAppRequest('Could you please open the Chrome browser?');
 assert.deepEqual(matchInstalledApp(installed,request),{exact:true,candidates:[installed[1]]});
 assert.deepEqual(matchInstalledApp(installed,installedAppRequest('请打开应用 Chrome - Work')),{
  exact:true,candidates:[installed[2]],
 });
 for(const prompt of ['Open https://example.com','Open C:\\Apps\\Chrome.exe','Open chrome.exe','Launch Chrome --incognito','Open Chrome & calc /x','How can I open Chrome?']){
  const parsed=installedAppRequest(prompt);
  assert.ok(!parsed||!matchInstalledApp(installed,parsed).exact,prompt);
 }
});
