const {
  withDangerousMod,
  withAndroidColors,
  withAndroidColorsNight,
  withStringsXml,
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

// The Mapbox Android SDK reads the `mapbox_access_token` string resource when no token
// has been set in code. Writing it here makes the token available before the first view
// is created, independently of when `Mapbox.setAccessToken` is called from JavaScript.
const ANDROID_ACCESS_TOKEN_RESOURCE = "mapbox_access_token";

// Returns the name of another file in `res/values` that already defines the token
// resource, or null. A resource may only be defined once per directory: a second
// definition in strings.xml fails the build with "Duplicate resources".
const findOtherTokenResourceFile = async (platformProjectRoot) => {
  const valuesDir = path.join(platformProjectRoot, "app", "src", "main", "res", "values");
  let entries;
  try {
    entries = await fs.readdir(valuesDir);
  } catch {
    return null;
  }

  const definition = new RegExp(`<string[^>]*\\sname="${ANDROID_ACCESS_TOKEN_RESOURCE}"`);
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".xml") || entry === "strings.xml") {
      continue;
    }
    const contents = await fs.readFile(path.join(valuesDir, entry), "utf8");
    if (definition.test(contents)) {
      return entry;
    }
  }
  return null;
};

const withAndroidAccessToken = (config, accessToken) => {
  // Nothing to write without a token.
  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return config;
  }

  return withStringsXml(config, async (config) => {
    const otherFile = await findOtherTokenResourceFile(config.modRequest.platformProjectRoot);
    if (otherFile) {
      config.modResults = AndroidConfig.Strings.removeStringItem(
        ANDROID_ACCESS_TOKEN_RESOURCE,
        config.modResults
      );
      warnOnce(
        "android",
        `res/values/${otherFile} already defines the "${ANDROID_ACCESS_TOKEN_RESOURCE}" string resource, so the accessToken option was not written to strings.xml.`
      );
      return config;
    }

    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: ANDROID_ACCESS_TOKEN_RESOURCE, translatable: "false" },
          _: accessToken,
        },
      ],
      config.modResults
    );
    return config;
  });
};

// The token is stored in the app on both platforms (Info.plist and a string resource),
// so it has to be a public one.
const warnAboutSecretToken = (accessToken) => {
  if (typeof accessToken === "string" && accessToken.trim().startsWith("sk.")) {
    const message =
      'The accessToken option starts with "sk.", which is a secret Mapbox token. The value is written into the app (Info.plist on iOS, a string resource on Android). Use a public token that starts with "pk." instead.';
    warnOnce("ios", message);
    warnOnce("android", message);
  }
};

const withAndroidConfig = (config, { accessToken, androidColorOverrides }) => {
  const configWithAccessToken = withAndroidAccessToken(config, accessToken);

  const configWithAndroidColors = withAndroidColors(configWithAccessToken, (config) => {
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
  warnAboutSecretToken(accessToken);

  const configWithIos = withIosConfig(config, {
    accessToken,
    mapboxMapsVersion,
  });
  const configWithAndroid = withAndroidConfig(configWithIos, {
    accessToken,
    androidColorOverrides,
  });
  return configWithAndroid;
};

module.exports = withConfig;
