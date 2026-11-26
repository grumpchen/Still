# Task: Integrated Still learning workbench validation

- Agent: Codex (integration and independent verification); implementation by Luna workers
- Time: 2026-11-26T14:48:00+00:00
- Branch: `agent/codex/still-workbench`
- Baseline: `4121e8a70d358ee17288b33028ed176ab7bed9de` (main; terminal GitHub read succeeded, still main at recheck)

## Done
- Dashboard-first startup, cross-workspace Today agenda, last-course resume, and transactional Dashboard editing including Browser.
- Global named full-content layout templates, centralized management, explicit append/replace, ID remapping, scoped Undo, and legacy size-preset upgrade using real current content.
- Global source-backed Files/links Library, course-required PDF/link/idea Capture; Notes remain in course workspaces.
- Shared manual/AI/rule operation service, strict structured AI actions, real receipts, ambiguous-object clarification, and persistent filing/layout rules with capture provenance, local schedules, serialized evaluation and duplicate prevention.
- Native tray ticks and replay, embedded Browser lifecycle, and awaited external App close/move handling.
- Preserved existing data and explicit appearance preferences. Reduced software-GPU background load and changed the new-profile default to the existing static wave appearance.

## Checks
- Unchanged main baseline: TypeScript/build passed; frontend 464/502 passed (38 failures recorded in `docs/validation/main-baseline.json`).
- Integrated root at `179aeba`: TypeScript, production build, frontend **585/585 passed**; no skipped frontend tests.
- Independent integrated Chromium suite after E2E-contract updates: **43/43 passed**, single worker, Linux Chromium 156; includes prior PDF citations and selection-to-note flows, recovery, Dashboard editing, Library originals, actual template content/append/replace/Undo, structured AI operations, one-sentence rules, automatic scheduled layout preparation, receipts, clarification and reload deduplication.
- Independent final rule/recovery subset: **5/5 passed** after local-time and duplicate-rule fixes.
- Dashboard button contrast inspected and tested in both glass themes by Luna; root screenshot review found and prompted the fix.
- Performance harness (six samples per profile, production build, same cloud software renderer): main default medians startup 1240ms, Study 2941ms, Dashboard 2915ms; candidate new default 85/112/69ms; candidate saved Liquid Chrome profile 375/380/210ms. Exact values and method are in `docs/validation/*performance.json`. These include browser automation and are **not native Windows responsiveness measurements**.

## Native validation status — final candidate passed
- **Windows run [45844571306](https://github.com/grumpchen/Still/actions/runs/45844571306): success**, source `f8ad35700891ae19ce27fb72f13757ac0e377adb`.
- TypeScript and **598/598 frontend tests**, **147 Rust domain tests plus both separately executed real-window geometry fixtures (149 total)**, release executable build, and all eight native smoke checks passed. No `continue-on-error` bypass is used.
- The same release executable was tested and uploaded. SHA-256: `4a043c5742d79d400cf23d54373654e2642d8b6c68a9a4b8cb2efbc1ac03c81b`.
- Native checks exercised Dashboard rendering/fullscreen, isolated embedded Browser creation/navigation/closure, real minimize-to-tray and hidden tick delivery.
- Through the actual Still AI UI, saved a future one-time layout rule. Still was hidden at **15:07:22.477Z**; actual layout replacement started at **15:07:35.129Z**, succeeded, and left the main window hidden. A subsequent native tick retained the same widget IDs, one receipt, and a successful terminal watermark.
- Structured receipt/timing/visibility evidence is retained in `docs/validation/windows-final.json`. Executable artifact ID: `15131701933`; smoke JSON/screenshot artifact ID: `15131802112`. The executable artifact includes its SHA-256 sidecar.
- Automation opted into WebView2 CDP on the isolated Actions runner. The binary defaults to no CDP; production background flags use actual Tauri WebView2 options.
- Earlier CDP startup, fixture desktop maximum tracking dimensions, and test-harness source-text lookup failures were corrected and retested. Prior failed runs remain in history; the final run above supersedes their pending status.

## Handoff / limits
- Main is unchanged. No release/tag has been published. Review: [PR #15](https://github.com/grumpchen/Still/pull/15); branch `agent/codex/still-workbench` has the implementation and verification records.
- Cloud browser cannot exercise native PDF grants, real tray-menu clicks, third-party embedded application interaction or desktop smoothness. No interactive remote Windows desktop was identified. Hosted Windows process automation is reported separately.
- AI provider transport is mocked in browser action tests; deterministic supported one-sentence rules run without API credentials. No live-model quality claim is made.
- Browser-preview Downloads now has a capability-aware fallback and the Library opens collected PDF references or saved links. The root-rendered fallback test passed, and root screenshots confirmed no raw invoke error. Large-library AI metadata is bounded and explicitly marked partial, with actual search retained.
- Final source candidate `f8ad35700891ae19ce27fb72f13757ac0e377adb`: **598/598 frontend tests passed**, TypeScript/build passed; full Chromium **43/43 passed** (1.6 minutes). Includes native multi-batch search and a browser 401-root partial-result regression.
- Layout application rebases onto current state after native awaits; target/template conflicts preserve data, other workspace edits and newer active-workspace choices survive, and Undo records the real precommit state. Library is excluded as a layout source/target because it is an aggregate view.

## Final candidate performance
- Remeasured the final production build after all source changes, without another browser test running. Fresh-profile medians: **88ms startup / 177ms Study / 77ms Dashboard**. Saved main Liquid Glass profile: **333 / 477 / 192ms**. Main baseline: **1240 / 2941 / 2915ms**. Raw six-sample results and precise method: `docs/validation/final-performance.json`. These are cloud browser automation measurements, not native Windows cold-start or smoothness measurements.
- Global native Library search now batches up to 40 roots per request with a 500-result and 400-root aggregate bound, and explicitly marks partial results. The native command safety limit is unchanged.
