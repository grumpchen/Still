import type {AutomationAction,AutomationOperationContext,AutomationOperationResult,AutomationOperationService,AutomationStorage,RuleCatalog} from '../domain/automationRules.ts';
import {parseWorkbenchActions,validateWorkbenchActionBatch,type LinkOrigin,type InterfaceAction,type WorkbenchAction} from '../domain/workbenchActions.ts';
import type {CollectionOperationRequest,CollectionOperationResult} from '../domain/collectionOperations.ts';
import type {CaptureInboxEvent} from '../domain/captureInbox.ts';
import {createWidget,deleteSavedGroup,nextInstanceNumber,saveGroupName,type GlobalWorkspaceLayout,type WorkspaceState} from '../domain/workspaces.ts';
import {nextPlacement} from '../domain/layout.ts';
import {widgetCatalog} from '../domain/widgetCatalog.ts';
import type {AutomationRunSummary} from '../domain/automationRunner.ts';
import {executeCollectionOperation as sharedCollectionOperation} from './collectionOperations.ts';
import {localFiles,type LibrarySearchResponse} from './files.ts';

import {operateCanvas,type CanvasCommand} from './canvasCommands.ts';
import {operateFilesView,type FilesViewCommand} from './filesViewCommands.ts';
import {applyWorkspaceCommand,type WorkspaceCommand} from '../domain/workspaceCommands.ts';

export type WorkbenchCaptureEvent=CaptureInboxEvent;
export type WorkbenchLayoutHandlers={
 save:(name:string,sourceWorkspaceId:string)=>string|Promise<string>;
 apply:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;prepare?:(layoutId:string,targetWorkspaceId:string,mode:'append'|'replace')=>string|Promise<string>;
 rename:(layoutId:string,name:string)=>string|Promise<string>;
 duplicate:(layoutId:string)=>string|Promise<string>;
 delete:(layoutId:string)=>string|Promise<string>;
};
export type WorkbenchReceipt={operation:WorkbenchAction['operation'];status:'succeeded'|'failed'|'needs_clarification'|'outcome_unknown';summary:string;receiptId?:string;data?:unknown;changed?:boolean};
export interface WorkbenchSnapshot {workspaces:Array<{id:string;name:string;role:string;files:Array<{widgetId:string;name:string;kind:'folder'|'document';connected:boolean}>;links:Array<{id:string;name:string;url:string;origin:LinkOrigin}>;groups?:Array<{id:string;name:string;shortcutCount:number;widgetCount:number}>;dashboardModules?:Array<{id:string;type:string;title:string;visible:boolean}>}>;layouts:Array<{id:string;name:string;createdAt:number;widgetCount:number;groupCount:number}>;automationRules?:Array<{id:string;enabled:boolean;sourceText:string;trigger:unknown;action:unknown;latestReceipt?:{status:string;updatedAt:string;message?:string}}>}
export interface WorkbenchRuleAdmin {list:()=>WorkbenchSnapshot['automationRules'];enable:(id:string,value:boolean)=>string;setLayoutMode:(id:string,mode:'append'|'replace')=>string;delete:(id:string)=>string;runDue:()=>Promise<AutomationRunSummary>}
export interface WorkbenchServiceOptions {
 getState:()=>WorkspaceState;commitState:(state:WorkspaceState)=>void|Promise<void>;getLayouts?:()=>GlobalWorkspaceLayout[];layoutHandlers:WorkbenchLayoutHandlers;
 collection?:(action:CollectionOperationRequest,context:{source:'assistant'|'automation';idempotencyKey?:string})=>Promise<CollectionOperationResult>;
 saveRule:(text:string)=>Promise<{kind:'rule';rule:unknown}|{kind:'clarification'|'unsupported'|'error';message:string}>;
 getCaptureEvent:(eventId:string)=>Promise<WorkbenchCaptureEvent|null|{ok:true;value:WorkbenchCaptureEvent|null}|{ok:false;message:string}>;getCourses?:()=>RuleCatalog['courses'];
 searchFiles?:(widgetIds:string[],query:string)=>Promise<LibrarySearchResponse>;
 interfaceAction?:(action:InterfaceAction)=>string;
 viewport?:()=>{width:number;height:number};
 ruleAdmin?:WorkbenchRuleAdmin;
