import {currentFileRequest,currentFilesView,isFilesLocationQuestion} from './platform/currentFilesView.ts';
import {useEffect,useRef,useState} from 'react';
import type {WorkspaceState} from './domain/workspaces.ts';
import type {InterfaceAction,WorkbenchAction} from './domain/workbenchActions.ts';
import {loadAutomationState,type RuleCatalog} from './domain/automationRules.ts';
