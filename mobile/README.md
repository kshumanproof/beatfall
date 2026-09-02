# Beatfall for phones

The capture sidekick. Its whole job is the two seconds between having an idea
and losing it: the app opens, the cursor is already blinking, you type, you tap
Keep. No projects, no board, no structure — those are desk decisions.

This is a real native app. It builds to an `.ipa` for the Apple App Store and an
`.aab` for Google Play. It is not a website in a wrapper.

## Run it on your phone

You need [Node.js](https://nodejs.org) on this machine and the **Expo Go** app on
your phone (free, in the App Store and on Google Play). Your phone and this
computer have to be on the same Wi-Fi.

```
cd beatfall-mobile
npm install          # once, and after any change to package.json
npx expo start
```

A QR code appears in the terminal.

- **iPhone** — open the Camera app, point it at the QR code, tap the banner.
- **Android** — open Expo Go, tap *Scan QR code*.

The app loads over Wi-Fi. Edit a file, save, and the phone reloads by itself.

If the phone can't find the computer, run `npx expo start --tunnel` instead —
slower, but it works across networks and through most office firewalls.

## What works today

Capture, and nothing else — but capture properly:

- The note is written to a SQLite database on the phone **before** the screen
  says it was kept. The network is never in that path, so airplane mode, a dead
  cell, and a force-quit all lose nothing.
- Notes survive closing the app, restarting the phone, and updating the app.
- Light and dark follow the phone's own setting.
- Hold a note to throw it away.

Not built yet: signing in, and sending the notes to your project on the web app.
`SYNC_ENABLED` in `src/config.js` is `false`, and while it is, the app says
nothing about syncing — claiming notes are "waiting to sync" when there is
nowhere for them to go would be a lie on the first screen a writer ever sees.

## Layout

```
index.js              entry point
app.json              app name, icons, bundle ids, splash
src/App.js            fonts, theme, boot
src/Capture.js        the one screen
src/store.js          the local SQLite store — the durability promise
src/store.web.js      memory-only stand-in, used ONLY by `expo export --platform web`
src/theme.js          the palette, copied from the web app's theme.css
src/config.js         SYNC_ENABLED, API_BASE
tools/mkicon.py       regenerates the placeholder icons
assets/               icons and splash
```

`src/theme.js` and `public/theme.css` in the web repo are the same palette
written twice. Change one, change the other, or the two halves of Beatfall stop
looking like one product.

## The icons are placeholders

Paper, a rule, and the wordmark's own `b`. They exist because an app will not
install without an icon. Replace all six files in `assets/` when the real mark
arrives; `tools/mkicon.py` regenerates them if you want a different letter.

## Getting it into the stores

Not yet, and not from this folder alone. It needs an Apple Developer account
($99/year), a Google Play developer account ($25 once), and a build service —
`eas build` is the normal one. Bundle id is already set to `com.beatfall.app`
on both platforms.
