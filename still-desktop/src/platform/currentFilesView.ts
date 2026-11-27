import type { Workspace } from '../domain/workspaces.ts';

const focusedFiles = new Map<string, string>();

export function focusFilesView(workspaceId: string, widgetId: string) {
  focusedFiles.set(workspaceId, widgetId);
}

export function currentFilesView(workspace: Workspace, selectedIds: string[] = []) {
  const visibleViews = Array.from(document.querySelectorAll<HTMLElement>(
    '.workspace-surface:not([hidden]) .files-widget[data-files-location]',
  ));
  const candidates = visibleViews.flatMap(view => {
    const card = view.closest<HTMLElement>('.canvas-card:not(.widget-minimized)');
    const widgetId = card?.dataset.widgetId;
    const folder = view.dataset.filesLocation;
    if (widgetId === undefined || folder === undefined) return [];
    const widget = workspace.widgets.find(item => item.id === widgetId && item.type === 'files');
    if (!widget || widget.fileKey) return [];
    return [{
      widgetId, folder, folderName: view.dataset.filesRoot ?? '',
      selectedFile: view.dataset.filesSelected,
      onlyFile: view.dataset.filesOnly,
    }];
  });
  const selected = candidates.filter(view => selectedIds.includes(view.widgetId));
  if (selectedIds.length) return selected.length === 1 ? selected[0] : undefined;
  return candidates.find(view => view.widgetId === focusedFiles.get(workspace.id))
    ?? (candidates.length === 1 ? candidates[0] : undefined);
}

const polite = /^(?:(?:please|(?:can|could|would) (?:you|u))\s+)+/i;

export function currentFileRequest(input: string) {
  const prompt = input.trim().replace(polite, '').replace(/[。?？]$/, '').trim();
  const rename = prompt.match(/^(?:rename (?:this|the selected|the current) file|(?:把)?(?:这个|当前|选中的)文件(?:重命名|改名))(?:\s*(?:to\s+|为|成)\s*(.+))?$/i);
  const renameZh = prompt.match(/^(?:请)?(?:重命名|改名)(?:这个|当前|选中的)文件(?:\s*(?:为|成)\s*(.+))?$/);
  if (rename || renameZh) return { kind: 'rename' as const, name: (rename ?? renameZh)?.[1]?.trim() };
  const create = prompt.match(/^(?:add|create|make) (?:one |an? )?(?:(?:md|markdown|txt|text) file(?: (?:named|called) (.+?))?|[“"']?([^\r\n/\\]+?\.(?:md|txt))[”"']?)(?: (?:here|in (?:the )?current (?:page(?: of (?:the )?files widget)?|folder|directory)))?$/i);
  if (create) {
    const extension = /^(?:add|create|make) (?:one |an? )?(?:txt|text) file\b/i.test(prompt) ? 'txt' : 'md';
    const name = (create[1] ?? create[2])?.trim().replace(/^[“"']|[”"']$/g, '') || 'Untitled';
    return { kind: 'create' as const, name: name.includes('.') ? name : `${name}.${extension}` };
  }
  const createZh = prompt.match(/^(?:请)?(?:在(?:当前目录|当前文件夹|这里))?(?:新建|创建)(?:一个)?\s*(Markdown|MD|TXT|文本)\s*文件(?:\s*(?:叫|命名为)\s*(.+))?$/i);
  if (createZh) {
    const extension = /^(?:TXT|文本)$/i.test(createZh[1]) ? 'txt' : 'md';
    const name = createZh[2]?.trim().replace(/^[“"']|[”"']$/g, '') || 'Untitled';
    return { kind: 'create' as const, name: name.includes('.') ? name : `${name}.${extension}` };
  }
  return undefined;
}
