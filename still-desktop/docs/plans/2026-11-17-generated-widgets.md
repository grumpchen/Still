# Still Agent 生成式组件：Luna 实施方案

基于 `agent/codex/leo3-deepseek-combined`，包含 `e78babf` 的 AI Command 按钮。此文档是实现交接，不代表功能已经完成。

## 结构现状

- `src/domain/widgetCatalog.ts` 和 `src/widgets.tsx` 是第一方 widget 类型及 renderer 注册点。不要为每个用户 prompt 动态注册新 React 类型。
- `src/domain/workspaces.ts` 的 `WidgetInstance`、`createWidget`、`checkedWidget` 和 `parseState` 负责 layout 状态创建、校验和迁移。未知类型在恢复时会被跳过。
- `src/domain/presets.ts` 用显式联合类型校验托盘快捷方式。`presetFromWidget` / `createWidgetFromPreset` 负责保存与恢复。当前普通快捷方式只保存有限字段。
- Group 同时支持快捷方式条目和 `kind: 'collected'` 的完整 widget 快照；复制 workspace 会为收集到的 widget 生成新 ID。
- `aiCommand` 已将名称与 prompt 保存为 widget 的 `title` / `text`，点击后通过 `still-run-ai-command` 进入 Assistant 现有 provider、workspace context 和审核流程。它当前不接文件到卡片、不直接保存结果，也没有生成式 schema。
- Agent 操作定义及审核在 `src/domain/assistant.ts`、`src/domain/assistantTools.ts` 和 `src/AssistantPanel.tsx`；桌面 AI transport 在 `src/platform/assistant.ts`。尽量复用这些入口，避免新增另一条 provider 或确认路径。

## 产品决策

把生成结果实现为一个固定的 `generatedWidget` 类型，所有卡片由 Still 的 React renderer 显示和执行。AI 只返回版本化声明式定义；定义选择 Still 已实现的输入/动作/输出组合。不要执行模型生成的 JavaScript、shell 命令或任意文件路径。现有 `aiCommand` 保持兼容，作为手动 prompt 快捷方式；之后可提供“转为组件”入口，但不要悄悄改变其既有语义。

首条可用路径：用户描述“把讲义变成五道复习题” → 生成预览 → 用户拖入或选择 TXT、Markdown 或有文字层的 PDF → 用户点击运行 → 结果在卡片中审阅 → 用户明确选择 Notes 目标并保存。模型创建定义时只收到需求及允许的能力；文档正文只在用户运行时按显示的范围发送给当前提供方。

初始 schema 建议：`schemaVersion: 1`、`title`、`input: 'pdf-or-text'`、`action: { kind: 'askAI', instruction }`、`output: 'review-note'`。初始版本只开放此组合。图片转 PDF 作为第二个受控组合（`images` + `imagesToPdf` + `save-pdf`），等选定和验证 PDF 写入库后再开放。标题和提示词有长度上限；统一解析器校验 AI 回复、用户编辑、local storage、Group snapshot 与 preset。

## 实现阶段

1. **Schema 与静态 widget。** 注册固定类型、纯 domain schema parser 和默认值；定义错误/未知版本的局部恢复行为。完成 workspace reload、复制、Group 收纳/恢复、托盘 preset 往返。旧数据不含定义时继续正常运行，损坏的一张卡不能抛弃整个 workspace。
2. **卡片编辑和运行。** 组件菜单提供创建入口；先用本地表单与固定样例跑通定义编辑、预览和保存。再接 Assistant 现有 provider transport。运行状态绑定 `workspaceId/widgetId/runId`；重复点击去重，切换工作区或删卡后丢弃迟到结果。
3. **本地文件输入和 Notes 输出。** TXT、Markdown、PDF 可选/拖入；显示来源、文件大小及 PDF 页码/截取范围。复用 Files/PDF.js 已有读取能力；扫描件明确说明无文字层。保留输入文件授权，替换/删除/卸载时释放。结果先可编辑审阅；用户主动选 Notes 目标，确认写入成功后才显示已保存。
4. **Assistant 创建入口。** Agent 可生成同一 schema 的待审提案，再交给阶段 2 的编辑器。验证中文/英文、无效 JSON、不支持能力、拒绝、重复审批和 workspace 变化；不要在 Assistant 里另写 widget renderer 或绕开当前审核机制。
5. **图片转 PDF 与发布验收。** 仅支持 PNG/JPEG，先固定 PDF 写入依赖并验证离线构建；图序来自可见排序，输出另存为。完成模拟 AI Playwright 流程、Windows CI 和 Windows 桌面验收：Explorer drop、125%/150% DPI、取消保存对话框、重启恢复。真实 provider 只做一次短样本人工验收并记录请求次数。

## 持久化与安全检查

- 遍历 `checkedWidget`、`parseState`、`presetFromWidget`、`widgetPreset`、`createWidgetFromPreset`、Group 快照校验及恢复路径，确保新定义完整往返。
- 检查 `duplicateWorkspace` 对组件定义做深拷贝并生成独立实例 ID。
- 不持久化临时文件授权、正文预览、runId、模型响应状态或目标文件绝对路径；仅保存规则和 layout。
- 新增的 Notes 写入调用限定到现有 Notes API，并由用户选择目标。取消/失败不应标记成功或静默覆盖。
- 断网、API 错误、超长输入、扫描 PDF、卡片删除、切换 workspace 和重复点击均保留可恢复状态。

## PR 验收文本

**标题：** Add AI-generated action widgets

**描述：** 用户可用自然语言创建可重复使用的 Still 组件。组件基于版本化声明式定义，由 Still 控件负责文件输入、运行、审阅和保存。首个版本支持从 TXT、Markdown 和有文本的 PDF 生成复习材料，并由用户确认后保存到 Notes。现有 AI Command 保持兼容。

**首 PR 范围：** 阶段 1–3；Assistant 创建入口和图片转 PDF 可独立后续提交。

**验收场景：** 创建复习题组件，输入讲义，看到文件来源与读取范围，运行后审阅结果，主动保存到选定 Notes；重启后规则仍在，并可处理下一份讲义。取消保存、AI 错误、无文字 PDF、超限输入、删除组件或切换 workspace 不得丢失草稿、重复提交或写错目标。

**验证：** `pnpm check`、相关单测、`pnpm test`、Playwright 使用模拟 transport；Windows CI 构建。PR 说明实际执行的命令、结果和未完成的平台验收。
