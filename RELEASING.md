# Releasing

Every merge to `main` that changes what users get (skills, agents, hooks, docs shipped with the plugin) must land in a published release — plugin users only pick up changes when the version in `.claude-plugin/plugin.json` is bumped and the matching `vX.Y.Z` release exists.

## Process

1. In the same PR as your change, bump the version in **both** files:
   - `.claude-plugin/plugin.json` → `version`
   - `.claude-plugin/marketplace.json` → `plugins[].version`

   Use semver: patch for fixes, minor for new/changed skills or behavior, major for breaking changes.
2. Merge the PR to `main`.
3. Done — the [`release.yml`](.github/workflows/release.yml) workflow runs on every push to `main` that touches `plugin.json`. It verifies both versions match, then creates the `vX.Y.Z` tag and a GitHub release with auto-generated notes. If the release already exists, it does nothing.

There is no manual tagging step. If a merge landed without a version bump (so no release was published), open a follow-up PR that only bumps the version — the workflow will publish a release covering everything merged since the last one.

## How users update

Users update through the normal plugin channel (`/plugin` → update, or reinstalling from the marketplace), which serves the latest published version from this repo.
