# Expo Mapbox Navigation

A simple Expo wrapper for Mapbox's navigation SDK's on Android and iOS

## Installation

### `@rnmapbox/maps`

This package relies on the installation of `@rnmapbox/maps`, so you'll have to install and set it up as explained in their [installation instructions](https://rnmapbox.github.io/docs/install). **Use the versions listed under [Compatibility](#compatibility) and explicitly set the Mapbox Maps version with `RNMapboxMapsVersion`, because this package relies on this being set to work.**

### Compatibility

Version 1.6.x is built for the following combination:

| Dependency | Version |
| --- | --- |
| `@rnmapbox/maps` | `10.1.44` |
| `RNMapboxMapsVersion` / `mapboxMapsVersion` | `11.11.0` |
| Mapbox Navigation SDK | Android `3.11.0`, iOS `3.8.0` (bundled as `.xcframework`s built against Mapbox Maps `11.11.0`) |
| Expo SDK | 53 and 54 (verified on Android) |

- **Android:** Navigation SDK `3.11.0` depends on Mapbox Maps `11.14.0`, so Gradle resolves Mapbox Maps to `11.14.0` even when `RNMapboxMapsVersion` is `11.11.0`.
- **Not supported yet:** `@rnmapbox/maps` `10.3.x` (Mapbox Maps `11.33`). The app builds, but crashes at launch on both Android and iOS because the Navigation SDK versions above do not match that Mapbox Maps version. The config plugin prints a warning during `expo prebuild` when it detects this combination. Supporting current Mapbox Maps versions requires updating the Navigation SDK on both platforms and is planned for the next major version.
- **Android Gradle Plugin 9** (built-in Kotlin) is supported.

> [!NOTE]  
> Make sure to follow the instructions carefully and include the proper token in the config plugin and to call the `Mapbox.setAccessToken` function. You can be sure everything is good when you're able to render a map.

### Install package

**Install via npm (recommended):**

```bash
npm install @badatgil/expo-mapbox-navigation
```

Or directly from GitHub:

```json
// package.json
"dependencies": {
  "@badatgil/expo-mapbox-navigation": "github:uju777/expo-mapbox-navigation"
}
```

### Configure package

In your `app.json` or `app.js`, you'll need to add a plugin for the package under the `plugins` entry with a valid mapbox access token (The one that starts with `pk.`). For the mapbox maps version, you have to use the same version set in the setup steps of `@rnmapbox/maps`.

```json
"plugins": [
    ...other plugins
     [
        "@badatgil/expo-mapbox-navigation",
        {
          "accessToken": "<YOUR_TOKEN>",
          "mapboxMapsVersion": "<MAPBOX_MAPS_VERSION>"
        }
      ]
]
```

Additionally you need to enable `useFrameworks` in your ios config. This can be achieved by using the `expo-build-properties` package and plugin as follows:

```json
"plugins": [
    ...other plugins
     [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ],
]
```

#### More notes on plugin

The plugin also has a `androidColorOverrides` field which allows you to define resource colors in the android app. This is particualrly useful to override some of the predefined mapbox colors and customize the apperance of the components. It is somewhat tricky to find which colors to change, but looking through the [mapbox repo](https://github.com/mapbox/mapbox-navigation-android/blob/main/ui-components/src/main/res/values/colors-maneuver.xml) may help

```json
"plugins": [
    ...other plugins
     [
        "@badatgil/expo-mapbox-navigation",
        {
          "accessToken": "<YOUR_TOKEN>",
          "mapboxMapsVersion": "<MAPBOX_MAPS_VERSION>",
          "androidColorOverrides": {
            "mapbox_main_maneuver_background_color": "#FF0000"
          }
        }
      ]
]
```

### Usage

After getting location permissions you can render the navigation map as follows anywhere in the app

```
<MapboxNavigationView
    style={{ flex: 1 }}
    coordinates={coordinates} />
```

> [!NOTE]
> On Android the Mapbox access token comes from `Mapbox.setAccessToken(...)` of `@rnmapbox/maps`. That call is asynchronous, so render `MapboxNavigationView` only after its promise has resolved. If the view is created before the token is set, it fails with a `MapboxConfigurationException`.

```tsx
const [tokenReady, setTokenReady] = React.useState(false);

React.useEffect(() => {
  Mapbox.setAccessToken("<YOUR_TOKEN>").then(() => setTokenReady(true));
}, []);

if (!tokenReady) {
  return null;
}
```

## Props

#### `coordinates`

An array of `{latitude: number, longitude: number}` objects. This creates a route passing through all the given coordinates. Requires at least 2 points for start and end destinations.

#### `waypointIndices`

An array of indices representing which of the coordinates is to be considered a waypoint/destination. By default all coordinates are considered waypoints (and show a waypoint indicator), passing this prop allows choosing which of the coordinates are waypoints. At least the first and last element need to be included in the array for a route to render.

#### `useRouteMatchingApi`

When enabled, uses Mapbox's Map Matching API to generate the route instead of the regular navigation route generation APIs. Enable this when you want a more explicit path determined by the coordinates. [Mapbox Map Matching API](https://docs.mapbox.com/api/navigation/map-matching/)

#### `locale`

A string representation of a locale/language code that adjusts the Map labels, directions, and voice where possible. By default, uses the devices locale.

#### `routeProfile`

The profile to use for route generation. `mapbox/driving-traffic` by default. See [here](https://docs.mapbox.com/api/navigation/directions/#routing-profiles) for details. NOTE: For android, you need to omit the `mapbox/` prefix.

#### `routeExcludeList`

An array of road types and locations to exclude from the route. See the `exclude` param [here](https://docs.mapbox.com/api/navigation/directions/#optional-parameters) for details.

#### `mapStyle`

The style of the Mapbox map. See [here](https://docs.mapbox.com/api/maps/styles/) for details.

#### `mute`

Whether the navigation audio is initially muted.

#### `vehicleMaxHeight`

The maximum height of the vehicle in meters. This is used to avoid routes with height restrictions.

#### `vehicleMaxWidth`

The maximum width of the vehicle in meters. This is used to avoid routes with width restrictions.

#### `customRasterSourceUrl`

The URL of a custom raster source to use for the map. Should be a template string with `{x}`, `{y}`, `{z}` placeholders.  
Example: `"https://tile.openstreetmap.org/{z}/{x}/{y}.png"`

#### `placeCustomRasterLayerAbove`

The ID of the layer above which the custom raster layer should be placed. Useful for controlling the rendering order of map layers.

#### `disableAlternativeRoutes`

If true, disables calculation and display of alternative routes. By default, alternative routes may be shown if available.

#### `onRouteProgressChanged`

Called when the user's progress on the route changes.
Provides an object in the `nativeEvent` of type:

```ts
{
  distanceRemaining: number;
  distanceTraveled: number;
  durationRemaining: number;
  fractionTraveled: number;
}
```

#### `onCancelNavigation`

Called when the cancel navigation button is clicked. The library does not handle cancellation automatically, use this callback to handle the cancellation behaviour.

#### `onWaypointArrival`

Called when arrived at one of the given waypoints.
On **Android ONLY** provides an object in the `nativeEvent` of type:

```ts
{
  distanceRemaining: number;
  distanceTraveled: number;
  durationRemaining: number;
  fractionTraveled: number;
}
```

#### `onFinalDestinationArrival`

Called when arrived at the final destination

#### `onRouteChanged`

Called when the route changes or reroutes

#### `onUserOffRoute`

Called when the user goes off route

#### `onRoutesLoaded`

Called when routes are finished loading.
Provides the loaded routes in the `nativeEvent` as `{ routes: { mainRoute, alternativeRoutes } }`. Each route contains `distance`, `expectedTravelTime` and `legs` with their step coordinates.

#### `onRouteFailedToLoad`

Called when the route request fails. Provides `{ errorMessage: string }` in the `nativeEvent`.

#### `initialLocation`

An object `{latitude: number, longitude: number, zoom?: number}` used to position the map camera before navigation starts. On Android `zoom` defaults to `14`.

#### `followingZoom`

Fixes the zoom level of the camera while it follows the user during navigation.

## Ref methods

#### `recenterMap()`

Moves the camera back to following the user's location.

```tsx
const ref = React.useRef<MapboxNavigationViewRef>(null);

<MapboxNavigationView ref={ref} style={{ flex: 1 }} coordinates={coordinates} />;

ref.current?.recenterMap();
```

## Running the example app

- Run `yarn` on the root directory
- `cd example`
- Run `yarn` on the example app
- Run the app using `npx expo run:android` / `npx expo run:ios`

## Note on Mapbox version updates (for collaborators)

The Android implmentation uses the gradle dependencies and can easily be updated to newer versions.

iOS, however, bundles the Mapbox Navigation SDK into the expo module to be used. As of the date of writing this, the Mapbox Navigation SDK v3 does not support cocoapods and only supports Swift package manager. There is no obvious way on how one can include a package from the Swift package manager into an Expo module, so I opted to bundle the `.xcframework` package instead.

> [!NOTE]  
> Cocoapods support is apparently comming soon. When that day comes, this process can be made much easier.

### Getting the `.xcframework` files

First make sure .netrc is configured with your mapbox credentials.

Clone https://github.com/mapbox/mapbox-navigation-ios from the desired version branch.

Use this modified `Package.swift` and update the versions according to the cloned branch. Checksum for `navNativeChecksum` will be incorrect. Run `swift build -c release` which will fail and give you the correct checksum to update with. After updating, proceed with steps, do not re-run.

```swift
// swift-tools-version:5.7
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let (navNativeVersion, navNativeChecksum) = ("324.0.0", "f7c0b81c2092faf60eea32538e630e5b67bb7d032251548a2b38054d0ede90f6")

let mapsVersion: Version = "11.11.0"
let commonVersion: Version = "24.11.0"

let mapboxApiDownloads = "https://api.mapbox.com/downloads/v2"

let package = Package(
    name: "MapboxNavigation",
    defaultLocalization: "en",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "MapboxNavigationUIKit",
            targets: ["MapboxNavigationUIKit"]
        ),
        .library(
            name: "MapboxNavigationCore",
            targets: ["MapboxNavigationCore"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/mapbox/mapbox-maps-ios.git", exact: mapsVersion),
        .package(url: "https://github.com/mapbox/mapbox-common-ios.git", exact: commonVersion),
        .package(url: "https://github.com/mapbox/turf-swift.git", exact: "4.0.0")
    ],
    targets: [
        .target(
            name: "MapboxNavigationUIKit",
            dependencies: [
                "MapboxNavigationCore",
            ],
            exclude: ["Info.plist"],
            resources: [
                .copy("Resources/MBXInfo.plist"),
                .copy("Resources/PrivacyInfo.xcprivacy")
            ]
        ),
        .target(name: "_MapboxNavigationHelpers"),
        .target(
            name: "MapboxNavigationCore",
            dependencies: [
                .product(name: "MapboxCommon", package: "mapbox-common-ios"),
                "MapboxNavigationNative",
                "MapboxDirections",
                "_MapboxNavigationHelpers",
                .product(name: "MapboxMaps", package: "mapbox-maps-ios"),
            ],
            resources: [
                .process("Resources")
            ]
        ),
        .target(
            name: "MapboxDirections",
            dependencies: [
                .product(name: "Turf", package: "turf-swift"),
            ]
        ),
        navNativeBinaryTarget(
            name: "MapboxNavigationNative",
            version: navNativeVersion,
            checksum: navNativeChecksum
        ),
    ]
)

private func navNativeBinaryTarget(name: String, version: String, checksum: String) -> Target {
    let url = "\(mapboxApiDownloads)/dash-native/releases/ios/packages/\(version)/MapboxNavigationNative.xcframework.zip"
    return .binaryTarget(name: name, url: url, checksum: checksum)
}
```

Clone https://github.com/giginet/Scipio/ **inside** the cloned mapbox-navigation-ios repo. `cd` inside that repo and run `swift build -c release`.

While still in the Scipio repo run

```
swift run -c release scipio create ../ -f \
    --platforms iOS  \
    --only-use-versions-from-resolved-file \
    --enable-library-evolution \
    --support-simulators \
    --embed-debug-symbols \
    --verbose
```

Based on https://github.com/mapbox/mapbox-navigation-ios/issues/4703#issuecomment-2297452009
