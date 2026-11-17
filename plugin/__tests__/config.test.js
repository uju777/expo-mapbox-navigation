// Tests for the config plugin. Run with `yarn test` (uses the Node.js test runner).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..", "..");
const pluginFile = path.join(repoRoot, "plugin", "config.js");
const { WarningAggregator } = require("@expo/config-plugins");

// Load the plugin with its internal helpers exposed, without changing the published module.
const loadPlugin = () => {
  const source =
    fs.readFileSync(pluginFile, "utf8") +
    "\nmodule.exports.__internals = { applyPodfilePostInstallModifications, readRnmapboxVersion, reportedWarnings };\n";
  const pluginModule = new Module(pluginFile, null);
  pluginModule.filename = pluginFile;
  pluginModule.paths = Module._nodeModulePaths(path.dirname(pluginFile));
  pluginModule._compile(source, pluginFile);
  return pluginModule.exports;
};

const withConfig = loadPlugin();
const { applyPodfilePostInstallModifications, readRnmapboxVersion, reportedWarnings } =
  withConfig.__internals;

// Collect the warnings the plugin reports instead of printing them.
const warnings = [];
WarningAggregator.addWarningIOS = (_plugin, message) => warnings.push(["ios", message]);
WarningAggregator.addWarningAndroid = (_plugin, message) => warnings.push(["android", message]);
const resetWarnings = () => {
  reportedWarnings.clear();
  warnings.length = 0;
};

const count = (text, pattern) => (text.match(pattern) || []).length;
const VERSION_LINE = /^ENV\['ExpoNavigationMapboxMapsVersion'\] = '.*'$/gm;
const SNIPPET = /BUILD_LIBRARY_FOR_DISTRIBUTION/g;
const PODFILE =
  "platform :ios, '15.1'\n\ntarget 'app' do\n  use_expo_modules!\n  post_install do |installer|\n    react_native_post_install(installer)\n  end\nend\n";

const baseConfig = (projectRoot = repoRoot) => ({
  name: "x",
  slug: "x",
  _internal: { projectRoot },
});
// Temporary directories are removed when the test run ends.
const tempDirs = [];
const tempDir = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
test.after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
const modRequest = (platform, modName, platformProjectRoot) => ({
  platformProjectRoot,
  projectRoot: platformProjectRoot,
  platform,
  modName,
  introspect: false,
  nextMod: async (config) => config,
});

// The Podfile patch written by plugin versions before 1.6.4.
const applyOldPlugin = (podfile, version) =>
  (`ENV['ExpoNavigationMapboxMapsVersion'] = '${version}'\n` + podfile).replace(
    "post_install do |installer|",
    `post_install do |installer|
      installer.pods_project.targets.each do |target|
          if (target.name.include? 'MapboxMaps' or target.name.include? 'Turf')
            target.build_configurations.each do |config|
              config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
            end
          end
        end`
  );

test("Podfile: a fresh Podfile gets one version line and one snippet", () => {
  const patched = applyPodfilePostInstallModifications(PODFILE, "11.11.0");
  assert.equal(count(patched, VERSION_LINE), 1);
  assert.ok(patched.startsWith("ENV['ExpoNavigationMapboxMapsVersion'] = '11.11.0'\n"));
  assert.equal(count(patched, SNIPPET), 1);
  assert.ok(patched.includes("react_native_post_install(installer)"));
});

test("Podfile: running again replaces the version and does not duplicate the snippet", () => {
  const first = applyPodfilePostInstallModifications(PODFILE, "11.11.0");
  const second = applyPodfilePostInstallModifications(first, "11.14.0");
  assert.equal(count(second, VERSION_LINE), 1);
  assert.ok(second.startsWith("ENV['ExpoNavigationMapboxMapsVersion'] = '11.14.0'\n"));
  assert.equal(count(second, SNIPPET), 1);
  assert.equal(applyPodfilePostInstallModifications(second, "11.14.0"), second);
});

test("Podfile: stale lines and snippets left by older plugin versions are handled", () => {
  const once = applyOldPlugin(PODFILE, "11.8.0");
  const threeTimes = applyOldPlugin(applyOldPlugin(once, "11.9.0"), "11.10.0");
  assert.equal(count(threeTimes, VERSION_LINE), 3);

  const patched = applyPodfilePostInstallModifications(threeTimes, "11.11.0");
  assert.equal(count(patched, VERSION_LINE), 1);
  assert.ok(patched.includes("'11.11.0'"));
  for (const stale of ["11.8.0", "11.9.0", "11.10.0"]) {
    assert.ok(!patched.includes(stale));
  }
  assert.equal(count(patched, SNIPPET), count(threeTimes, SNIPPET));

  const patchedOnce = applyPodfilePostInstallModifications(once, "11.11.0");
  assert.equal(count(patchedOnce, SNIPPET), 1);
  assert.equal(count(patchedOnce, VERSION_LINE), 1);
});

test("Podfile: without a post_install block the version is written and a warning is reported", () => {
  resetWarnings();
  const patched = applyPodfilePostInstallModifications(
    "platform :ios, '15.1'\ntarget 'app' do\nend\n",
    "11.11.0"
  );
  assert.equal(count(patched, VERSION_LINE), 1);
  assert.equal(count(patched, SNIPPET), 0);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "ios");
  assert.match(warnings[0][1], /post_install/);
});

test("Podfile: CRLF line endings are handled", () => {
  const crlf = applyPodfilePostInstallModifications(PODFILE, "11.11.0").replace(/\n/g, "\r\n");
  const patched = applyPodfilePostInstallModifications(crlf, "11.11.0");
  assert.equal(count(patched, /ExpoNavigationMapboxMapsVersion/g), 1);
  assert.equal(count(patched, SNIPPET), 1);
});

test("iOS: the access token is written to Info.plist", () => {
  const config = withConfig(baseConfig(), { accessToken: "pk.test", mapboxMapsVersion: "11.11.0" });
  assert.equal(config.ios.infoPlist.MBXAccessToken, "pk.test");
});

test("iOS: a missing mapboxMapsVersion only fails when the iOS project is generated", async () => {
  const config = withConfig(baseConfig(), { accessToken: "pk.test" });
  assert.doesNotThrow(() => withConfig(baseConfig()));

  const iosRoot = tempDir("emn-ios-");
  fs.writeFileSync(path.join(iosRoot, "Podfile"), PODFILE);
  await assert.rejects(
    config.mods.ios.dangerous({
      ...config,
      modRequest: modRequest("ios", "dangerous", iosRoot),
      modResults: null,
      modRawConfig: config,
    }),
    /mapboxMapsVersion/
  );
  assert.equal(fs.readFileSync(path.join(iosRoot, "Podfile"), "utf8"), PODFILE);
});

test("iOS: the Podfile is patched when mapboxMapsVersion is given", async () => {
  const config = withConfig(baseConfig(), { accessToken: "pk.test", mapboxMapsVersion: "11.11.0" });
  const iosRoot = tempDir("emn-ios-");
  fs.writeFileSync(path.join(iosRoot, "Podfile"), PODFILE);
  await config.mods.ios.dangerous({
    ...config,
    modRequest: modRequest("ios", "dangerous", iosRoot),
    modResults: null,
    modRawConfig: config,
  });
  const patched = fs.readFileSync(path.join(iosRoot, "Podfile"), "utf8");
  assert.equal(count(patched, VERSION_LINE), 1);
  assert.equal(count(patched, SNIPPET), 1);
});

test("warnings: a Mapbox Maps version other than the bundled one is reported once", () => {
  resetWarnings();
  for (let i = 0; i < 3; i++) {
    withConfig(baseConfig(), { accessToken: "pk", mapboxMapsVersion: "11.33.0" });
  }
  const mismatch = warnings.filter(
    ([platform, message]) => platform === "ios" && /mapboxMapsVersion is 11\.33\.0/.test(message)
  );
  assert.equal(mismatch.length, 1);

  for (const version of ["11.11.0", "11.11.4"]) {
    resetWarnings();
    withConfig(baseConfig(), { accessToken: "pk", mapboxMapsVersion: version });
    assert.equal(warnings.filter(([, message]) => /mapboxMapsVersion is/.test(message)).length, 0);
  }
});

const fakeProjectWithRnmapbox = (version, hidePackageJson) => {
  const root = tempDir("emn-project-");
  const packageDir = path.join(root, "node_modules", "@rnmapbox", "maps");
  fs.mkdirSync(packageDir, { recursive: true });
  const manifest = { name: "@rnmapbox/maps", version, main: "index.js" };
  if (hidePackageJson) {
    manifest.exports = { ".": "./index.js" };
  }
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(packageDir, "index.js"), "module.exports = {};");
  return root;
};

test("warnings: the installed @rnmapbox/maps version is found", () => {
  assert.equal(readRnmapboxVersion(fakeProjectWithRnmapbox("10.1.44", false)), "10.1.44");
  assert.equal(readRnmapboxVersion(fakeProjectWithRnmapbox("10.3.18", true)), "10.3.18");
  assert.equal(readRnmapboxVersion(tempDir("emn-empty-")), null);
});

test("warnings: @rnmapbox/maps 10.3 and newer is reported on both platforms", () => {
  const cases = [
    ["10.1.44", false],
    ["10.2.9", false],
    ["10.3.0", true],
    ["10.3.18", true],
    ["11.0.0", true],
    ["10.3.0-rc.1", true],
  ];
  for (const [version, expectWarning] of cases) {
    resetWarnings();
    withConfig(baseConfig(fakeProjectWithRnmapbox(version, true)), {
      accessToken: "pk",
      mapboxMapsVersion: "11.11.0",
    });
    const reported = warnings
      .filter(([, message]) => /@rnmapbox\/maps .* is installed/.test(message))
      .map(([platform]) => platform)
      .sort();
    assert.deepEqual(reported, expectWarning ? ["android", "ios"] : [], `@rnmapbox/maps ${version}`);
  }
});

const runStringsMod = async (config, strings, androidRoot = tempDir("emn-android-")) => {
  const result = await config.mods.android.strings({
    ...config,
    modRequest: modRequest("android", "strings", androidRoot),
    modResults: { resources: { string: strings } },
    modRawConfig: config,
  });
  return result.modResults.resources.string;
};
const tokenItems = (strings) => strings.filter((item) => item.$.name === "mapbox_access_token");

test("Android: the access token is written to the mapbox_access_token string resource", async () => {
  const config = withConfig(baseConfig(), { accessToken: "pk.test", mapboxMapsVersion: "11.11.0" });
  let strings = await runStringsMod(config, [{ $: { name: "app_name" }, _: "x" }]);
  assert.equal(tokenItems(strings).length, 1);
  assert.equal(tokenItems(strings)[0]._, "pk.test");
  assert.equal(tokenItems(strings)[0].$.translatable, "false");
  assert.equal(strings.length, 2);

  // running prebuild again keeps a single resource
  strings = await runStringsMod(config, strings);
  assert.equal(tokenItems(strings).length, 1);
  assert.equal(strings.length, 2);

  // a changed token, or a resource defined elsewhere, is replaced
  const changed = withConfig(baseConfig(), { accessToken: "pk.new", mapboxMapsVersion: "11.11.0" });
  strings = await runStringsMod(changed, strings);
  assert.deepEqual(tokenItems(strings).map((item) => item._), ["pk.new"]);
  strings = await runStringsMod(changed, [{ $: { name: "mapbox_access_token" }, _: "pk.app" }]);
  assert.deepEqual(tokenItems(strings).map((item) => item._), ["pk.new"]);
});

test("Android: no string resource is written without an access token", () => {
  const optionSets = [
    { mapboxMapsVersion: "11.11.0" },
    { accessToken: "", mapboxMapsVersion: "11.11.0" },
    { accessToken: "   ", mapboxMapsVersion: "11.11.0" },
    { accessToken: 123, mapboxMapsVersion: "11.11.0" },
    undefined,
  ];
  for (const options of optionSets) {
    const config = withConfig(baseConfig(), options);
    assert.equal(config.mods?.android?.strings, undefined);
  }
});

test("Android: the token is not written when another values file defines the resource", async () => {
  const androidRoot = tempDir("emn-android-");
  const valuesDir = path.join(androidRoot, "app", "src", "main", "res", "values");
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(path.join(valuesDir, "colors.xml"), "<resources></resources>");
  fs.writeFileSync(
    path.join(valuesDir, "mapbox.xml"),
    '<resources>\n  <string translatable="false" name="mapbox_access_token">pk.app</string>\n</resources>'
  );

  resetWarnings();
  const config = withConfig(baseConfig(), { accessToken: "pk.test", mapboxMapsVersion: "11.11.0" });
  // strings.xml still holds the value written by an earlier prebuild
  const strings = await runStringsMod(
    config,
    [
      { $: { name: "app_name" }, _: "x" },
      { $: { name: "mapbox_access_token", translatable: "false" }, _: "pk.test" },
    ],
    androidRoot
  );
  assert.equal(tokenItems(strings).length, 0);
  assert.equal(strings.length, 1);
  const reported = warnings.filter(([platform, message]) => platform === "android" && /mapbox\.xml/.test(message));
  assert.equal(reported.length, 1);

  // a values file that only mentions a similar name does not count
  fs.writeFileSync(
    path.join(valuesDir, "mapbox.xml"),
    '<resources><string name="other_mapbox_access_token">x</string></resources>'
  );
  const written = await runStringsMod(config, [{ $: { name: "app_name" }, _: "x" }], androidRoot);
  assert.equal(tokenItems(written).length, 1);
});

test("warnings: a secret access token is reported on both platforms", () => {
  resetWarnings();
  withConfig(baseConfig(), { accessToken: "sk.secret", mapboxMapsVersion: "11.11.0" });
  const reported = warnings
    .filter(([, message]) => /secret Mapbox token/.test(message))
    .map(([platform]) => platform)
    .sort();
  assert.deepEqual(reported, ["android", "ios"]);

  resetWarnings();
  withConfig(baseConfig(), { accessToken: "pk.public", mapboxMapsVersion: "11.11.0" });
  assert.equal(warnings.filter(([, message]) => /secret Mapbox token/.test(message)).length, 0);
});

test("Android: color overrides are registered next to the token resource", () => {
  const config = withConfig(baseConfig(), {
    accessToken: "pk.test",
    mapboxMapsVersion: "11.11.0",
    androidColorOverrides: { mapbox_main_maneuver_background_color: "#FF0000" },
  });
  for (const mod of ["colors", "colorsNight", "strings"]) {
    assert.equal(typeof config.mods.android[mod], "function", mod);
  }
});
