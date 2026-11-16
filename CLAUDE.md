# expo-mapbox-navigation

> Expo module that wraps the Mapbox Navigation SDK.

## Language: English only

This is a public, global repository. Everything that ends up in it must be written in English:

- Commit messages (subject and body), tag messages and branch names
- Source code comments, documentation, `README.md`, `CHANGELOG.md` and this file
- GitHub issues, pull requests, review comments and release notes
- npm package metadata

Commit with plain `git commit -m "<English subject>" -- <paths>`. Do not use wrapper tools that append generated text to the commit message.

The only exception is third-party localization data, such as the `ko.lproj` files inside the bundled Mapbox frameworks.

## Tech stack

- TypeScript (Expo module)
- Swift (iOS), Kotlin (Android)
- Mapbox Navigation SDK

## Main directories

- `src/` — TypeScript module source
- `ios/`, `android/` — native code
- `example/` — example app
- `plugin/` — Expo config plugin

## Build

```bash
yarn build      # expo-module build
yarn clean      # expo-module clean
```

## Release

1. Move the `Unpublished` entries in `CHANGELOG.md` under a new version heading.
2. Bump `version` in `package.json` and commit as `chore: bump version to x.y.z`.
3. Tag the commit as `vx.y.z` and push the branch and the tag.
4. Run `npm publish`, then publish the GitHub release for the tag.
