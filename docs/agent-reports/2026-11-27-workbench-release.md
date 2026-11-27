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
- Publication verification pending workflow execution.

## Handoff
- Release is a prerelease and will not replace the latest stable release. Main remains unchanged.
