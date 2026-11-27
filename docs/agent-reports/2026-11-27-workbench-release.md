# Task: Publish the verified workbench preview

- Agent: Codex (coordinator)
- Time: 2026-11-27 UTC

## Done
- User explicitly requested a release for testing.
- Added a narrowly scoped publication workflow to transfer the exact successful Actions candidate to a prerelease, without rebuilding or merging main.
- The workflow verifies the original run's success/source SHA and the executable's SHA-256 before publishing assets.
- Release tag targets the tested source commit; notes distinguish the prerelease name from the unchanged in-app version title.

## Files
- `.github/workflows/publish-workbench-preview.yml`
- `docs/release-notes/workbench-preview.md`

## Checks
- Original candidate run 45844571306 remains successful.
- Direct terminal artifact download returned Forbidden; publication uses GitHub-hosted Actions instead.
- Publication workflow 45950928519: success. Candidate identity check and release upload passed.
- Published `v0.2371-workbench.1` as a non-draft prerelease targeting tested source `f8ad35700891ae19ce27fb72f13757ac0e377adb`.
- Verified both release assets are uploaded. GitHub reports the exe asset digest as `sha256:4a043c5742d79d400cf23d54373654e2642d8b6c68a9a4b8cb2efbc1ac03c81b`, matching the accepted candidate.
- Release: https://github.com/grumpchen/Still/releases/tag/v0.2371-workbench.1

## Handoff
- Release is a prerelease and will not replace the latest stable release. Main remains unchanged.
