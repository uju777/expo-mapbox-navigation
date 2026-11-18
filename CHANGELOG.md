# Changelog

## Unpublished

### 🛠 Breaking changes

### 🎉 New features

- Add the `voiceUnits` prop (`"imperial"` or `"metric"`) to set the unit of the spoken distances independently of the locale ([#31](https://github.com/uju777/expo-mapbox-navigation/issues/31)).
- Config plugin (Android): the `accessToken` option is now also written to the `mapbox_access_token` string resource. The Mapbox SDK falls back to that resource when no token has been set in code, so the view can be created without waiting for `Mapbox.setAccessToken()`. If another file in `res/values` already defines the resource, the plugin leaves it alone and prints a warning.
- Config plugin: print a warning when the `accessToken` option starts with `sk.` (a secret token). The option is stored in the app on both platforms.

### 🐛 Bug fixes

- Android: the route request now sets `voice_units`. Without the `voiceUnits` prop it is derived from the `locale` prop: imperial for the countries `US`, `LR` and `MM`, metric otherwise. The parameter was not set before, so the Directions API default (imperial) was used regardless of the locale. This changes the spoken unit for every locale outside those three countries, for example `en-GB` or a locale without a country such as `en`; set `voiceUnits="imperial"` to keep the previous unit.
- Android: `onRouteFailedToLoad` is now called when a Map Matching request fails (`useRouteMatchingApi`). The failure was ignored before.
- Android: when the view cannot be created because no access token is set, a message that names the missing token is written to logcat. When the JavaScript bundle runs in development mode (`__DEV__`) and expo-modules-core provides `AppContext.errorManager`, the message is also reported to the JavaScript console. In release builds it is only written to logcat.
- Android: a `MapboxNavigationView` now attaches the activity to `MapboxNavigationApp` when it is created instead of relying on the module having done so. The module attaches the activity from a coroutine when the activity enters the foreground. A view that was created before that coroutine had run kept a `null` `MapboxNavigation`, and its route request was skipped without an error (the observer registrations are guarded by the same null check). This is not new in this release; the test notes below say how often it happened with 1.6.4.
- Android: add consumer R8 rules (`android/proguard-rules.pro`): two `-dontwarn` rules for the AutoValue annotation classes that the Mapbox Java models reference. With 1.6.4, a release build of our Expo 54 test app with minification enabled stopped in R8 with `Missing class com.google.auto.value.AutoValue`. With the rules the build completes, and the app starts and sends the route request; a minified build was not tested with a loaded route.
- iOS: `max_height` and `max_width` are only added to the route request when `vehicleMaxHeight` / `vehicleMaxWidth` are set. The request was built with `0.0` for a missing value before.

### 💡 Others

- Android: changed props are applied in one update after each render instead of one update per prop.
- Add tests for the config plugin (`yarn test`) and a GitHub Actions workflow that builds the module and runs them.

_How this was tested: on Android with Expo 54, `@rnmapbox/maps` 10.1.44 and a placeholder access token, on an emulator, with the New Architecture disabled and enabled. Debug and release builds of a test app whose first screen is the navigation view were built and started, and the route request URL and the events were read from logcat. The route itself was never loaded because the token is not valid, so the map style, guidance and audio were not exercised. Release builds were built without minification, with R8 minification, and with minification and resource shrinking; the `mapbox_access_token` resource was still in the minified and shrunk APKs. The route request was sent in all 35 release starts of this version (20 with the New Architecture disabled, 15 with it enabled); in 17 of them the view attached the activity before the module did (16 and 1). It was also sent again after the activity had been recreated in a running process (3 runs, New Architecture disabled). With the published 1.6.4, in release builds without minification of the same app, which had a `mapbox_access_token` string resource, the request was missing in 4 of 10 starts with the New Architecture disabled and in 2 of 10 starts with it enabled. The JavaScript console report for a missing token was observed in debug builds; in release builds the message was only in logcat. The Android code was also compiled with Expo 53 and Expo 58. The iOS changes were compiled for the simulator in an Expo 58 test project and not run._

## 1.6.4 — 2026-11-16

### 🎉 New features

- The config plugin now warns during `expo prebuild` when the installed `@rnmapbox/maps` or the configured `mapboxMapsVersion` is outside the tested combination.

### 🐛 Bug fixes

- Android: the Gradle script of this module no longer fails to configure with Android Gradle Plugin 9 built-in Kotlin. The `kotlin-android` plugin is only applied when AGP has not registered the `kotlin` extension ([#44](https://github.com/uju777/expo-mapbox-navigation/pull/44) by [@gabrieldonadel](https://github.com/gabrieldonadel)), and `kotlinOptions` is only configured when that plugin is applied.
- Types: import `ViewStyle` and `StyleProp` from `react-native` instead of `react-native/types`. The old path does not exist in newer React Native versions (verified on 0.88), which silently typed the `style` prop as `any`.
- Config plugin: on iOS, throw a clear error when the `mapboxMapsVersion` option is missing instead of writing `'undefined'` into the Podfile.
- Config plugin: the Podfile patch can now run more than once on the same Podfile without duplicating its lines, and a changed `mapboxMapsVersion` is no longer overridden by a stale line.
- iOS: remove the podspec reference to a `Turf.xcframework` that is not part of the package, and point the podspec source at the current repository.

### 💡 Others

- README: add a compatibility table, explain how to set the access token on Android, and document `initialLocation`, `followingZoom`, `onRouteFailedToLoad`, the `onRoutesLoaded` payload and the `recenterMap()` ref method.
- `.npmignore`: exclude local files (`CLAUDE.md`, `android/.gradle`, `yarn.lock`) so that they cannot end up in the npm package.
- Remove `package-lock.json`. The repository uses yarn, and the stale npm lock file made `npm ci` fail.

## 1.6.3 — 2026-11-16

_Tagged but not published to npm. Its documentation contained inaccurate statements, which are corrected in 1.6.4._
