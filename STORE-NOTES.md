# Jelly Dash — release notes for hosting and the app stores

Facts about the build, so the store forms can be filled in honestly. Re-check them whenever a feature is added.

## What the game does with data
- Collects nothing, sends nothing. No accounts, ads, analytics, tracking, in-app purchases or chat.
- Saves progress, settings and the player's own levels in the browser's local storage (`jellydash-v2`).
- No third-party requests: the font and every sound are built in (the font is embedded in `index.html`; sounds are synthesised).
- Level codes and save codes are plain text the player copies and pastes themselves. Shared level names are cleaned (`cleanName` in `js/save.js`).
- In-game privacy text: Settings → Privacy (`PRIVACY` in `js/ui.js`). A store listing needs a public privacy-policy URL; this text is a starting point for it.

## Age rating answers (Apple, Google IARC)
Cartoon mischief only: no violence beyond a cartoon splat when the jelly bumps a spike, no blood, no weapons, no profanity, no sexual or mature themes, no gambling, no horror, no alcohol/drugs.
User-generated content: levels can be shared by copying a code, with no public feed, chat or discovery. Expect to answer "yes, limited" to user-generated content and "no" to unrestricted web access and messaging.
Expected result: Apple 4+, Google "Everyone".
If the app is placed in a Kids category: no ads, no third-party SDKs and no external links are allowed, which this build already satisfies. Keep it that way.

## Photosensitivity
Measured on rendered frames (whole-screen luminance, 18-second runs at the fastest pace): no frame-to-frame change over 0.05 and no flash events on Sparkle Storm, Sugar Rush or Slime Queen. The death screen used to snap back to bright on every retry (a 0.46 jump); it now eases in and out (largest step 0.03). Settings → Reduce motion removes shake, spin and most particles. Re-run the measurement after changing effects or backgrounds.

## Hosting as an installable app
The install files are in this folder: `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, linked from `index.html`.
1. Serve the whole folder from any static HTTPS host (the page and `sw.js` must be on the same origin).
2. On Android Chrome: menu → Install app. On iPhone Safari: Share → Add to Home Screen.
3. Service workers do not run inside claude.ai artifacts, so install and offline play only work on a host of your own.

## Putting it in the stores
Wrap the folder with Capacitor (https://capacitorjs.com): `npm i @capacitor/core @capacitor/cli`, `npx cap init`, set `webDir` to this folder, `npx cap add ios android`, `npx cap sync`, then build in Xcode / Android Studio.
- iPhone: a native wrapper also enables vibration through the Haptics plugin (Safari does not support `navigator.vibrate`).
- Needs: Apple Developer and Google Play developer accounts, screenshots, the privacy-policy URL, and the age-rating questionnaires above.
- Test on real devices first: touch feel, audio start after the first tap, frame rate, and the sideways portrait mode.

## Still true
- No one has played this on a real phone and the music and sound effects have not been listened to; both are the first things to check.
