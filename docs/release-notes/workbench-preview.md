Still 学习工作台测试版

下载 `still-desktop.exe` 直接运行，无需安装。该文件与通过验收的 Windows 候选完全相同，没有重新构建。程序内版本标题仍显示 v0.2369，本测试版由提交和 SHA-256 标识。

新增：
- Dashboard 默认启动、今日安排、回到上次工作区，以及可保存/取消的组件布局编辑。
- 全局完整布局模板，跨工作区追加/替换和撤销。
- 全局 Files/链接 Library，按课程收集网页、PDF 和临时想法；Notes 留在课程中。
- Still AI 实际操作、执行回执与持久规则，支持托盘中自动整理或准备布局。

验收：598 项前端测试、43 条浏览器流程、149 项 Windows Rust/原生测试通过。已用本 exe 验证全屏 Dashboard、嵌入 Browser，以及 AI 保存规则后在托盘中实际应用布局且不重复执行。

尚未人工验收物理托盘菜单、真实第三方应用嵌入、现场恢复和 Windows 桌面流畅度。

候选提交：f8ad35700891ae19ce27fb72f13757ac0e377adb
SHA-256：4a043c5742d79d400cf23d54373654e2642d8b6c68a9a4b8cb2efbc1ac03c81b
验收：https://github.com/grumpchen/Still/actions/runs/45844571306
