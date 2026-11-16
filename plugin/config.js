const {
  withDangerousMod,
  withAndroidColors,
  withAndroidColorsNight,
  AndroidConfig,
  WarningAggregator,
} = require("@expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

const PLUGIN_NAME = "@badatgil/expo-mapbox-navigation";

// The iOS frameworks bundled with this version are built against this Mapbox Maps version.
const BUNDLED_IOS_MAPS_VERSION = "11.11";

const majorMinor = (version) => {
  const match = /(\d+)\.(\d+)/.exec(String(version ?? ""));
  return match ? [Number(match[1]), Number(match[2])] : null;
};

// The Expo CLI can evaluate the config more than once in the same process, so each
// distinct warning is only reported once.
const reportedWarnings = new Set();
const warnOnce = (platform, message) => {
  const key = `${platform}:${message}`;
  if (reportedWarnings.has(key)) {
    return;
  }
  reportedWarnings.add(key);
  if (platform === "ios") {
    WarningAggregator.addWarningIOS(PLUGIN_NAME, message);
  } else {
    WarningAggregator.addWarningAndroid(PLUGIN_NAME, message);
  }
};

// Returns the installed @rnmapbox/maps version, or null when it cannot be found.
// The second lookup covers package versions whose `exports` do not expose package.json.
const readRnmapboxVersion = (projectRoot) => {
  const candidates = [
    () => require.resolve("@rnmapbox/maps/package.json", { paths: [projectRoot] }),
    () => path.join(projectRoot, "node_modules", "@rnmapbox", "maps", "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate()).version;
    } catch {
      // try the next lookup
    }
  }
  return null;
};

/**
 * Warns during prebuild about version combinations that are known not to work, instead of
 * letting the app build and then crash at launch.
 */
const warnAboutUnsupportedVersions = (config, mapboxMapsVersion) => {
  const maps = majorMinor(mapboxMapsVersion);
  if (maps && maps.join(".") !== BUNDLED_IOS_MAPS_VERSION) {
    warnOnce(
      "ios",
      `mapboxMapsVersion is ${mapboxMapsVersion}, but the bundled Mapbox Navigation iOS frameworks are built against Mapbox Maps ${BUNDLED_IOS_MAPS_VERSION}.0. Other versions are untested and 11.33.0 is known to crash at launch. See the Compatibility section of the README.`
    );
  }

  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const rnmapboxVersion = readRnmapboxVersion(projectRoot);
  const version = majorMinor(rnmapboxVersion);
  if (version && (version[0] > 10 || (version[0] === 10 && version[1] >= 3))) {
    const message = `@rnmapbox/maps ${rnmapboxVersion} is installed. This version of ${PLUGIN_NAME} is tested with @rnmapbox/maps 10.1.x; with 10.3.x (Mapbox Maps 11.33) the app builds but crashes at launch. See the Compatibility section of the README.`;
    warnOnce("ios", message);
    warnOnce("android", message);
  }
};

/**
 * This plugin adds a post-install step to the Podfile that addresses linking issues between pods and xcframeworks.
 * In this case, the navigation library is added as an xcframework, and the maps library is added as a pod
 *
 * See https://github.com/CocoaPods/CocoaPods/issues/11079#issuecomment-984670700
 */

// Matches every version line, including duplicates written by earlier versions of this
// plugin. A stale line left behind would run after the new one and override it.
const MAPS_VERSION_ENV_LINES = /^ENV\['ExpoNavigationMapboxMapsVersion'\] = '.*'\r?\n/gm;
const POST_INSTALL_ANCHOR = "post_install do |installer|";
// Identifies the snippet below, whether it was inserted by this or an earlier version.
const POST_INSTALL_SNIPPET_SIGNATURE =
  "target.name.include? 'MapboxMaps' or target.name.include? 'Turf'";

// Safe to run more than once on the same Podfile (e.g. `expo prebuild` without `--clean`):
// the version line is replaced and the post_install snippet is only inserted once.
const applyPodfilePostInstallModifications = (src, mapboxMapsVersion) => {
  const versionLine = `ENV['ExpoNavigationMapboxMapsVersion'] = '${mapboxMapsVersion}'\n`;
  let contents = versionLine + src.replace(MAPS_VERSION_ENV_LINES, "");

  if (contents.includes(POST_INSTALL_SNIPPET_SIGNATURE)) {
    return contents;
  }

  if (!contents.includes(POST_INSTALL_ANCHOR)) {
    warnOnce(
      "ios",
      `Could not find "${POST_INSTALL_ANCHOR}" in the Podfile, so BUILD_LIBRARY_FOR_DISTRIBUTION was not set for the MapboxMaps and Turf pods. The iOS build may fail to link.`
    );
    return contents;
  }

  return contents.replace(
    POST_INSTALL_ANCHOR,
    `${POST_INSTALL_ANCHOR}
      installer.pods_project.targets.each do |target|
          if (${POST_INSTALL_SNIPPET_SIGNATURE})
            target.build_configurations.each do |config|
              config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
            end
          end
        end`
  );
};

const withIosPostInstallStep = (config, mapboxMapsVersion) =>
  withDangerousMod(config, [
    "ios",
    async (exportedConfig) => {
      // Only iOS uses this option, so Android-only setups that omit it keep working.
      if (!mapboxMapsVersion) {
        throw new Error(
          `${PLUGIN_NAME}: the "mapboxMapsVersion" plugin option is required on iOS and must match RNMapboxMapsVersion of @rnmapbox/maps (see the README).`
        );
      }

      const file = path.join(
        exportedConfig.modRequest.platformProjectRoot,
        "Podfile"
      );

      const contents = await fs.readFile(file, "utf8");
      await fs.writeFile(
        file,
        applyPodfilePostInstallModifications(contents, mapboxMapsVersion),
        "utf-8"
      );

      return exportedConfig;
    },
  ]);

const withIosTokenInfoPlist = (config, accessToken) => {
  if (!config.ios) {
    config.ios = {};
  }
  if (!config.ios.infoPlist) {
    config.ios.infoPlist = {};
  }

  config.ios.infoPlist["MBXAccessToken"] = accessToken;

  return config;
};

const withIosConfig = (config, { accessToken, mapboxMapsVersion }) => {
  const configWithPostInstallStep = withIosPostInstallStep(
    config,
    mapboxMapsVersion
  );
  const configWithAccessToken = withIosTokenInfoPlist(
    configWithPostInstallStep,
    accessToken
  );
  return configWithAccessToken;
};

const withAndroidConfig = (config, { androidColorOverrides }) => {
  const configWithAndroidColors = withAndroidColors(config, (config) => {
    let currentModResults = config.modResults;

    for (const [name, value] of Object.entries(androidColorOverrides ?? {})) {
      AndroidConfig.Colors.assignColorValue(currentModResults, { name, value });
    }

    config.modResults = currentModResults;

    return config;
  });

  const configWithAndroidColorsNight = withAndroidColorsNight(
    configWithAndroidColors,
    (config) => {
      let currentModResults = config.modResults;

      for (const [name, value] of Object.entries(androidColorOverrides ?? {})) {
        AndroidConfig.Colors.assignColorValue(currentModResults, {
          name,
          value,
        });
      }

      config.modResults = currentModResults;

      return config;
    }
  );

  return configWithAndroidColorsNight;
};

const withConfig = (
  config,
  { accessToken, mapboxMapsVersion, androidColorOverrides } = {}
) => {
  warnAboutUnsupportedVersions(config, mapboxMapsVersion);

  const configWithIos = withIosConfig(config, {
    accessToken,
    mapboxMapsVersion,
  });
  const configWithAndroid = withAndroidConfig(configWithIos, {
    androidColorOverrides,
  });
  return configWithAndroid;
};

module.exports = withConfig;
