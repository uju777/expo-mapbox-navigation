# Changelog

## Unpublished

### 🛠 Breaking changes

### 🎉 New features

- The config plugin now warns during `expo prebuild` when the installed `@rnmapbox/maps` or the configured `mapboxMapsVersion` is a combination that is known to crash at launch.

### 🐛 Bug fixes

- Android: support Android Gradle Plugin 9 built-in Kotlin. The `kotlin-android` plugin is only applied when AGP has not registered the `kotlin` extension ([#44](https://github.com/uju777/expo-mapbox-navigation/pull/44) by [@gabrieldonadel](https://github.com/gabrieldonadel)), and `kotlinOptions` is only configured when that plugin is applied.
- Types: import `ViewStyle` and `StyleProp` from `react-native` instead of `react-native/types`. The old path does not exist in newer React Native versions (verified on 0.88), which silently typed the `style` prop as `any`.
- Config plugin: on iOS, throw a clear error when the `mapboxMapsVersion` option is missing instead of writing `'undefined'` into the Podfile.
- Config plugin: the Podfile patch can now run more than once on the same Podfile without duplicating its lines, and a changed `mapboxMapsVersion` is no longer overridden by a stale line.
- iOS: remove the podspec reference to a `Turf.xcframework` that is not part of the package, and point the podspec source at the current repository.

### 💡 Others

- README: add a compatibility table, explain how to set the access token on Android, and document `initialLocation`, `followingZoom`, `onRouteFailedToLoad`, the `onRoutesLoaded` payload and the `recenterMap()` ref method.
- Stop shipping local files (`CLAUDE.md`, `android/.gradle`, `yarn.lock`) in the npm package.
- Remove `package-lock.json`. The repository uses yarn, and the stale npm lock file made `npm ci` fail.
