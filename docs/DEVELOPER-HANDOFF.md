# Still development handoff

Still is a Windows desktop workspace built with React, TypeScript, Vite and Tauri (Rust). The app source is in `still-desktop`. This guide describes the current development workflow, including work that is still being developed.

## Set up a checkout

Install Git, Node.js and pnpm, Rust with the Windows MSVC toolchain, and the prerequisites for Tauri on Windows. Clone the repository from GitHub and install the JavaScript dependencies in PowerShell.

```powershell
git clone git@github.com:grumpchen/Still.git
cd Still/still-desktop
pnpm install --frozen-lockfile
```

Each developer should use their own checkout. On this computer the current working checkout is `D:\Still\still-codex-notes-library`. It is on the `agent/codex/notes-library` branch and may have local work. Do not overwrite another person's changes.

## Run the desktop preview

From `still-desktop`, run `pnpm dev:desktop`. Wait for the Rust build and the window titled **Still · Live Development**. The first run can take several minutes. Keep the terminal open. Frontend changes normally reload automatically. Rust changes require the native app to rebuild. Stop the preview with Ctrl+C in its terminal.

The app uses port 4318. If it is occupied, check for an existing Still preview before starting another. `pnpm dev` runs only the Vite frontend in a browser and does not provide the native desktop features.

## Make and check changes

Create a branch from an up-to-date `main` for each task. Agree who owns each task, especially when editing shared files. A task should describe the behavior, include a short plan for larger changes and identify how to verify it.

```powershell
git switch main
git pull --ff-only origin main
git switch -c agent/your-name/short-task
cd still-desktop
pnpm check
pnpm test
pnpm build
```

Use the running desktop preview to check the changed feature. Native app attachment, Windows permissions and actual provider connections need desktop testing. Run relevant Rust tests for native code. Report what was tested and any failures.

## Share and merge work

Review `git status` and `git diff` before staging. Stage the intended source, tests and documentation by path. Do not add build targets, logs, credentials, personal files or generated installers.

```powershell
git add path/to/changed-file
git commit -m "fix(area): describe change"
git push -u origin agent/your-name/short-task
```

Open a pull request to `main` and have the other developer review the change and checks. Merge after review. Both developers should update their local `main` before starting the next branch. Never force-push shared branches or discard someone else's changes.

## Where to look

- `src/App.tsx` wires the workspace and assistant to app state.
- `src/AssistantPanel.tsx` contains the assistant UI and request flow.
- `src/domain/assistant.ts` and `src/domain/assistantTools.ts` contain assistant actions, validation and tool definitions.
- `src-tauri/src/` contains Windows integration and provider backends.
- `src/domain/widgetCatalog.ts` and `src/widgets.tsx` register and render widgets.
- `tests/` and `tests/e2e/` contain automated checks.
- `docs/agent-reports/` records recent changes and their verification.

The AI agent currently exposes only a subset of Still actions to the model. Timer phrases also have a local execution path. General control of every Still feature remains unfinished, and provider-backed flows need real desktop verification.

The 7 November development snapshot passed TypeScript and production build checks. A full test run reported failures involving appearance settings and app reopening and had not finished at the time of this handoff. Treat these as open work and check the current results before release.

The repository and product are currently named Still. Decide any new name together before renaming the repository, app identifiers or release artifacts.
