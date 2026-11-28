/**
 * Structured actions for Still features that live outside the active widget
 * canvas. Collection operations mirror the shared collection operation
 * service's request fields; this module validates wire data, not execution.
 */
import {widgetTypes,type WidgetType} from './workspaces.ts';
import {widgetCatalog} from './widgetCatalog.ts';
import type {WorkspaceCommand} from './workspaceCommands.ts';
import type {FilesViewCommand} from '../platform/filesViewCommands.ts';
import type {CanvasCommand} from '../platform/canvasCommands.ts';
import {snapLayouts} from './snapLayouts.ts';
export const workbenchPanels=['notes-home','settings','shortcuts','gallery','trayEdit','sidebarPlugins','commands','rules'] as const;
export type InterfaceAction={operation:'view.open';panel:typeof workbenchPanels[number]};
export type WorkbenchAction = InterfaceAction| WorkspaceCommand|FilesViewCommand|CanvasCommand
