# ver0.11 — visible Chrome and collapsible sidebar

The user accepts overlapping widgets and asks that the browser stay visible, plus a collapsible sidebar. This release follows the existing Tauri/React layout and owned top-level Chrome window pattern.

The Browser previously disappeared when a higher widget overlapped it, when it crossed the canvas edge, during any widget gesture, below a frontend minimum, or when Chrome's actual native window dimensions differed from the requested panel dimensions. Remove these visibility gates. Preserve intentional hiding for inactive workspaces, dialogs, minimizing Still, and switching to another application.

Chrome bounds allow negative client coordinates for partially scrolled panels. Native positioning accepts Chrome's minimum size, allowing overflow, and does not hide after a positioning failure. Location events accept larger windows rather than repeatedly requesting impossible dimensions. Widget screenshots crop the requested panel region from a larger native window. Chrome's fullscreen/maximized mode remains independent. The Browser resize handle moves into the widget header so the native window cannot cover it.

Add a top-left sidebar toggle with an accessible label, expansion state and target. Collapse the sidebar to a 52px icon rail with workspace, add and appearance buttons retained. Restore its normal 144px width when expanded. Save sidebarCollapsed alongside existing version 4 workspace data; older layouts default to expanded. ResizeObserver updates Chrome's host coordinates after toggling without restarting the browser or remounting canvases.

Regression tests first reproduced overlap/off-canvas hiding, missing sidebar persistence, and rejected negative native coordinates. Validation covers the corrected visibility and state migration, Chrome minimum-size event handling, native lifecycle smoke testing, TypeScript, production assets and the Windows executable. Signed-in AKO/EchoVideo, Google, extensions, video and live native input still need user acceptance; test profiles do not access the user's account or normal Chrome profile.

Results: 26 frontend tests and 13 native unit tests pass. The explicit real-Chrome smoke test, TypeScript, Vite and Windows release compilation pass. The browser preview verified collapse/expand, saved collapse after reload, restored workspace labels and header placement of the Browser resize handle. Preview screenshot: `../../../archive/older-versions/ver0.11-preview.jpg`. Executable: `../../../archive/older-versions/ver0.11.exe`, version 0.11.0.
