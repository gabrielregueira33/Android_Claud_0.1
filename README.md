# ClaudeMap

A small Android app that overlays free, key-less public APIs on an OpenStreetMap base layer:

| Layer            | Source                                  | Free / no key |
| ---------------- | --------------------------------------- | ------------- |
| Base map         | OpenStreetMap raster tiles              | Yes           |
| Cameras (CCTV)   | Overpass API (`man_made=surveillance`)  | Yes           |
| Traffic signals  | Overpass API (`highway=traffic_signals`)| Yes           |
| Earthquakes (24h)| USGS GeoJSON feed                       | Yes           |
| Precip radar     | RainViewer tiles                        | Yes           |

## Architecture

A thin Java `WebView` shell loads `assets/index.html`, which uses Leaflet to
render the map and pulls JSON / tiles directly from the public APIs above.
No SDK keys, no Google Play Services dependency.

The cameras / signals layer queries Overpass on every map move (debounced),
so it always shows live OSM data for the visible viewport.

```
src/com/claudemap/app/   Java sources (Activity + JS bridge)
assets/                  HTML / JS / Leaflet bundle
res/                     Strings + launcher icons
AndroidManifest.xml
build_apk.sh             Reproducible build with aapt2 + javac + d8 + apksigner
ClaudeMap.apk            Pre-built debug-signed APK (sideload-ready)
```

## Building

Requires JDK 21, Android build-tools 34.0.4, an `android.jar` (API 33).

```sh
ANDROID_HOME=/path/to/sdk \
BUILD_TOOLS=/path/to/sdk/build-tools/34.0.4 \
./build_apk.sh
```

The script:

1. Compiles resources with `aapt2 compile`
2. Links them + the manifest into a base APK with `aapt2 link`
3. Compiles Java with `javac` (target 1.8)
4. Converts to `classes.dex` with `d8 --min-api 21`
5. Inserts the dex into the APK and `zipalign`s
6. Generates a debug keystore on first run and signs with `apksigner` (v1+v2+v3)

Output: `ClaudeMap.apk`.

## Install

```sh
adb install -r ClaudeMap.apk
```

minSdk 21 (Android 5.0 Lollipop) / targetSdk 23.

## Permissions

* `INTERNET` — fetch tiles + API JSON
* `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — "Use my location" button
* `ACCESS_NETWORK_STATE`

## Notes

The app is signed with a generated debug key. For production distribution,
replace `build/debug.keystore` and the `apksigner` arguments with a release
keystore.
