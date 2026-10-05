from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from shutil import copy2
import hashlib
import json

root=Path(__file__).resolve().parents[1]
out=root.parent.parent/'outputs'
exe=root/'src-tauri/target/release/still-desktop.exe'
major,minor,*_=json.loads((root/'package.json').read_text(encoding='utf-8'))['version'].split('.')
release=f'ver{major}.{minor}'
filename=f'{release}.exe'
copy2(exe,out/filename)
overview=f'''# Still — {release}

Close all older Still windows, then open {filename}. Existing layouts, Groups, notes, appearance, Chrome profile and saved shortcuts are retained.

ver0.18 adds an open-app picker to the managed application panels introduced in ver0.17.

- Click **Apps** in the top widget tray to open **Attach open app**. Search currently open desktop windows by app or document name, see app icons and window titles, and use Refresh when opening another app. Already attached app/Chrome windows have an Attached badge and cannot be attached twice.
- Select a window, optionally rename its widget and check **Save app to tray**, then click **Attach selected app**. Still positions that exact window in a new movable/resizable card. Existing Apps cards have the same picker for replacing their application. Windows handle and process identity are checked again before attachment and never stored in saved layouts.
- **Preview** requests a small image for one window on demand. Previews have a time limit and do not block attachment. Minimized or unsupported windows can still be attached without a preview; unresponsive previews report their limitation.
- The Apps arrow expands saved buttons. Clicking one reuses a single available matching app window, or launches the app if none exists. If several documents/windows match, the card asks you to use Attach open app and choose the intended one. A widget can be renamed and saved from its own toolbar. Dragging the main Apps button still adds an empty Apps card.
- **Open app…** uses the Windows file picker for an application or ordinary app shortcut when it is not running. You can also open the app normally from Windows and click Refresh. The actual application retains its normal controls and documents.
- Move or resize the widget using Still's header and bottom-right handle. Native movement, resize, DPI and focus events keep the app aligned. The card grows on first attachment if the app enforces a larger minimum size; a native clip keeps excess content inside the panel instead of hiding it merely because another widget overlaps.
- Still minimizes or changes workspace: the managed app hides with its panel and is shown again when appropriate. Open-panel intent and geometry persist; picker-created panels reuse a single available matching app after reopening Still, or launch if none exists.
- **Detach**, removing/changing the widget, or closing Still releases the app back to its desktop placement. Still restores ownership and clipping without closing documents or killing the application. Manually closed app windows can be reopened.
- Managed app focus is recognized by workspace hotkeys and Chrome visibility. Widget screenshot/export captures include the attached app region.

The ver0.16 tray and saved shortcut features remain:

- Drag a widget header onto its matching tray button: green saves a reusable preset and keeps the open widget. Empty tray space turns red and removes only that instance. Dropping onto a different type or saved button does neither.
- Drag a PDF, document, image, media file or folder onto Files to save a named shortcut automatically. Drag a Windows .exe or .lnk shortcut onto Apps. Names and PDF/File/Folder/App badges distinguish resources.
- Drop supported items directly onto the canvas to create fresh cards without saving tray buttons. Drag a card onto its matching green button when you want to save it.
- Expand a type's ▾ arrow to reopen saved buttons by clicking or dragging. Each adds an independent instance. Pencil edits a preset; × removes its saved button while keeping opened widgets. Presets are available across workspaces and persist after restart.
- Browser presets remember a starting HTTPS URL. Notes and Assistant preserve text, Focus preserves remaining duration, and Timetable preserves entries. Files and Apps retain native references to the original resource rather than copying it. Changing one Files instance's folder keeps other instances independent.
- PDF cards open in the default PDF viewer. Receiving an app drop saves a shortcut without launching it. Click Open in panel or explicitly attach an existing app window to use an Apps card. Files viewing is otherwise unchanged.
- Windows .url Internet Shortcuts with HTTPS destinations can be dropped onto Browser. Raw Chrome URL/text drags are not guaranteed in the native app; the Browser preset editor remains available.
- Groups still support named collections, expandable tray buttons, reusable widget entries and website links. Existing move/resize handles, 80% Lecture mode, sidebar collapse, screenshot/export actions and customizable workspace hotkeys remain.

Chrome still supplies real tabs, bookmarks, extensions, authentication, downloads and video through Still's dedicated profile. Its area must be fully visible, at least 500 × 220 and clear of higher widgets; managed windows hide during gestures or when Still/workspaces are hidden. Close old versions to avoid competing layout writes or hotkeys. Chrome recovery remains scoped to its Still owner and widget.

Validation: 53 frontend tests and 27 Rust tests passed, plus TypeScript, Vite and Windows release compilation. One explicit Chrome GUI smoke test remains ignored. A hidden real Windows fixture verified native move/resize at 150% scale, viewport clipping, restoring ownership/placement, and leaving the window alive on release. New regression checks cover search/attached ordering, transient window identity, saved reuse/open intent, zero/one/multiple app-window matching, safe names, real GDI icon PNG encoding, and rejecting stale/hidden/closed windows before previews. Previous tray/layout/shortcut checks remain passing.

The isolated web preview verified both tray/card picker entry points, search and save controls, Cancel, the saved Apps section and its collapse behavior, without console errors. ver0.18-app-picker-preview.png shows that web preview, whose desktop actions are intentionally disabled. Actual Word/third-party listings, live previews and attachment require manual Windows acceptance because native UI control was unavailable. Native Explorer drag/drop, default PDF viewer and real screenshot/clipboard/export actions were not retested. Apps that do not expose a normal controllable Windows window, or run at a different Windows permission level, may not attach; the panel reports the problem. Native Chrome resizing, signed-in AKO/EchoVideo, extensions and fullscreen/video were not retested. Preview file selections require reconnecting after reload; desktop grants persist. The app is unsigned and has no installer.

Design and acceptance steps: work/still-desktop/docs/plans/2026-10-05-open-app-picker.md and 2026-10-05-managed-app-panels.md. Source: still-desktop-source.zip. Earlier executables and preview proofs remain available.
'''
(out/'README.md').write_text(overview,encoding='utf-8')
(root/'README.md').write_text(overview+'\nDevelopment: Tauri 2 + React + TypeScript. Build with pnpm test, pnpm check, pnpm tauri build --no-bundle, and cargo test --offline --release --manifest-path src-tauri/Cargo.toml.\n',encoding='utf-8')
(out/'implementation-plan.md').write_text(f'# Current implementation status — {release}\n\n'+overview.split('\n\n',2)[2]+'\nPlan: work/still-desktop/docs/plans/2026-10-05-open-app-picker.md\n',encoding='utf-8')
architecture=out/'architecture.md'
previous=architecture.read_text(encoding='utf-8')
if not previous.startswith('# Real Chrome overlay'):
 architecture.write_text('# Real Chrome overlay — current decisions\n\nThe latest release uses an owned top-level Chrome window positioned over the existing Browser panel, with a dedicated Chrome profile. SetParent is not used. Chrome supplies tabs, bookmarks and extensions. Event-driven native positioning, focus-filtered workspace hotkeys including Shift, retained visited canvases, saved shortcuts and 80% Lecture mode are implemented. Earlier browser decisions below are historical. See work/still-desktop/docs/plans/2026-10-04-chrome-overlay.md for checks and remaining interactive acceptance.\n\n---\n\n'+previous,encoding='utf-8')
current_note='ver0.18 adds a searchable Apps tray picker for open desktop windows, with executable metadata names, icons, explicit previews, Attached badges and exact HWND/PID validation. Selected identities are transient; saved widgets/presets retain only opaque native app grants. Saved-app clicks reuse one matching available window, refuse ambiguous document choices, or launch if no match exists. Previews use separate workers, bounded waiting and a limit of two outstanding renders. The ver0.17 native app geometry/ownership/clipping/release system remains, without SetParent. The web preview and automated fixtures passed; real third-party desktop acceptance remains pending. See work/still-desktop/docs/plans/2026-10-05-open-app-picker.md. Earlier notes below are historical.'
current_architecture=architecture.read_text(encoding='utf-8')
if current_note not in current_architecture:
 heading,rest=current_architecture.split('\n',1)
 architecture.write_text(heading+'\n\n'+current_note+'\n'+rest,encoding='utf-8')
excluded={'node_modules','target','dist','.git','.vite','__pycache__'}
archive=out/'still-desktop-source.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=7) as package:
 files=sorted(p for p in root.rglob('*') if p.is_file() and not any(part in excluded for part in p.relative_to(root).parts) and p.suffix not in {'.log','.tmp'} and p.name!='.DS_Store')
 for path in files:package.write(path,Path('still-desktop')/path.relative_to(root))
digest=hashlib.sha256(exe.read_bytes()).hexdigest()
assert hashlib.sha256((out/filename).read_bytes()).hexdigest()==digest
print(f'{filename}: {exe.stat().st_size} bytes; SHA256 {digest}')
print(f'Source archive: {len(files)} files; {archive.stat().st_size} bytes')
