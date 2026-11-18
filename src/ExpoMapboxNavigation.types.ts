// `react-native` is a peer dependency and is not installed in this repository, so the
// import is ignored when building the module. Consumers resolve these types from their
// own `react-native` (the old `react-native/types` path no longer exists in newer versions).
// @ts-ignore
import type { ViewStyle, StyleProp } from "react-native";
import { Ref } from "react";

type ProgressEvent = {
  distanceRemaining: number;
  distanceTraveled: number;
  durationRemaining: number;
  fractionTraveled: number;
};

type Route = {
  distance: number;
  expectedTravelTime: number;
  legs: Array<{
    source?: { latitude: number; longitude: number };
    destination?: { latitude: number; longitude: number };
    steps: Array<{
      shape?: {
        coordinates: Array<{ latitude: number; longitude: number }>;
      };
    }>;
  }>;
};

type Routes = {
  mainRoute: Route;
  alternativeRoutes: Route[];
};

export type ExpoMapboxNavigationViewRef = {
  recenterMap: () => void;
};

export type ExpoMapboxNavigationViewProps = {
  ref?: Ref<ExpoMapboxNavigationViewRef>;
  coordinates: Array<{ latitude: number; longitude: number }>;
  waypointIndices?: number[];
  useRouteMatchingApi?: boolean;
  locale?: string;
  /**
   * The unit of the spoken distances: `"imperial"` or `"metric"`. Any other value is
   * ignored.
   *
   * When it is not set, the unit follows `locale` (the device locale when `locale` is not
   * set). A Korean locale (`"ko"` or `"ko-KR"`) gives metric units, which is the unit used
   * in Korea, and `"en-US"` gives imperial units, so these need no `voiceUnits`.
   *
   * Set it when a locale should use the other unit, for example `locale="en-GB"` together
   * with `voiceUnits="imperial"`. Android and iOS decide the default differently (Android:
   * imperial for the countries `US`, `LR` and `MM`, metric for every other locale; iOS:
   * the measurement system that the system reports for the locale), so also set it when
   * both platforms have to use the same unit for a locale.
   *
   * On Android neither this prop nor the locale rule applies together with
   * `useRouteMatchingApi`, because the Map Matching request of the Navigation SDK version
   * in use has no unit option.
   */
  voiceUnits?: "imperial" | "metric";
  routeProfile?: string;
  routeExcludeList?: string[];
  mapStyle?: string;
  mute?: boolean;
  vehicleMaxHeight?: number;
  vehicleMaxWidth?: number;
  initialLocation?: { latitude: number; longitude: number; zoom?: number };
  /**
   * The URL of the custom raster source to use for the map.
   * Should be a template string with {x}, {y}, {z} placeholders.
   * Example: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
   */
  customRasterSourceUrl?: string;
  placeCustomRasterLayerAbove?: string;
  disableAlternativeRoutes?: boolean;
  followingZoom?: number;
  onRouteProgressChanged?: (event: { nativeEvent: ProgressEvent }) => void;
  onCancelNavigation?: () => void;
  onWaypointArrival?: (event: {
    nativeEvent: ProgressEvent | undefined;
  }) => void;
  onFinalDestinationArrival?: () => void;
  onRouteChanged?: () => void;
  onUserOffRoute?: () => void;
  onRoutesLoaded?: (event: { nativeEvent: { routes: Routes } }) => void;
  onRouteFailedToLoad?: (event: {
    nativeEvent: { errorMessage: string };
  }) => void;
  style?: StyleProp<ViewStyle>;
};
