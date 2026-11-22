# Yutani OS for Android

The site's screens as a native Android app. It keeps a full copy of every character's data on the
phone, opens from that copy at once, works with no connection, and asks the site only for what
changed. Developer notes are in [AGENTS.md](AGENTS.md); the design is in
`docs/superpowers/specs/2026-11-22-android-app-design.md`.

## What it needs

- The site deployed with the `/api/v1` routes (this repo, same commit or later).
- The phone on the same Tailscale network as the site whenever it syncs. Off Tailscale the app
  still opens and shows its copy, marked "offline".
- A Google account that is in the site's `allowed_google_emails`.

## One-off: the Android client in Google Cloud

Sign-in uses the Google project the site already has (see "Google sign-in set-up" in
`deploy/README.md`). Android only hands the app a Google token when that project also knows the
app, by its package name and the fingerprint of the key the APK is signed with:

1. Open <https://console.cloud.google.com/auth/clients> with the site's project selected.
2. **Create client** → application type **Android**.
3. **Package name:** `com.yutanios.app`
4. **SHA-1 certificate fingerprint:** the SHA-1 of your release key (below).
5. **Create.** Nothing needs copying back: the app is built with the *web* client's ID, which the
   site already uses, so the site verifies a phone's sign-in exactly as it verifies a browser's.

If you also install debug builds, repeat with the debug key's SHA-1 (a second Android client with
the same package name is allowed).

Print a key's SHA-1 with:

```
keytool -list -v -keystore <keystore file> -alias <alias> | grep SHA1
```

A new client can take a few minutes to start working. Until it does, the sign-in button answers
"No Google account is available" or a developer error.

## Private settings

Nothing private is in the repo. Two git-ignored files in this folder hold it:

`local.properties`

```
sdk.dir=/path/to/Android/Sdk
yutani.siteUrl=https://<your domain>
yutani.googleWebClientId=<the web client ID, as in secrets.yml google_client_id>
```

`keystore.properties` (release builds only)

```
storeFile=/absolute/path/outside/the/repo/release.jks
storePassword=…
keyAlias=…
keyPassword=…
```

Create a release key once and keep it, with its passwords, somewhere backed up. Android refuses to
install an update signed with a different key; losing the key means uninstalling the app (and its
copy of the data, which simply downloads again) before a new build can be installed.

```
keytool -genkeypair -keystore release.jks -storetype PKCS12 -alias yutani -keyalg RSA -keysize 4096 -validity 10950
```

## Build

Needs JDK 21 and the Android SDK (platform 37, build-tools).

```
export JAVA_HOME=<jdk 21> ANDROID_HOME=<Android SDK>
./gradlew :shared:jvmTest                 # tests
./gradlew :androidApp:assembleRelease     # androidApp/build/outputs/apk/release/androidApp-release.apk
```

## Install and update

Copy the APK to the phone and open it (Android asks once to allow installs from that source), or
with the phone on USB: `adb install -r androidApp-release.apk`. An update is the same step with a
newer APK; raise `versionCode` in `androidApp/build.gradle.kts` for each one.

## Signing out and lost phones

"Sign out" in the app (the button with your initials) removes the phone's token and its copy of
the data. Every signed-in phone is also listed on the site under Settings › Signed-in phones, with
a Revoke button; a revoked phone is signed out the next time it reaches the site.

## What syncs when

- When the app is opened, and when you pull down on any screen.
- About once an hour in the background while the phone has a network.
- The strip under the navigation shows the state: "Synced 5 m ago", "Updating 12/40", or
  "Offline · as of 2 h ago".

The phone keeps everything except wallet rows older than the newest 500 of each list, which are
fetched on demand, and icons it has never shown.
