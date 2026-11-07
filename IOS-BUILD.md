# Run Jelly Dash on an iPad from Xcode

Wraps the game with [Capacitor](https://capacitorjs.com) so Xcode can build it as an iOS app. The game files are not changed. These steps were written without being able to run them (they need a Mac), so if one fails, note the exact error.

## You need
- A Mac with **Xcode** (App Store, free) and **Node.js LTS** (https://nodejs.org). Open Xcode once and accept the licence.
- An **Apple ID**. A free one lets you run the app on your own iPad for 7 days at a time; the paid developer programme ($99 a year) removes that limit and is needed for the App Store.
- The iPad Pro, a cable, and **Developer Mode** switched on: Settings → Privacy & Security → Developer Mode (the iPad restarts).

## One-time setup (Terminal on the Mac)
```bash
git clone https://github.com/masonmagle-oss/jelly-dash.git
cd jelly-dash
npm i @capacitor/core @capacitor/cli @capacitor/ios
npm run prep
npm run ios:add
```
If `ios:add` asks for CocoaPods, install it with `sudo gem install cocoapods` (or `brew install cocoapods`) and run `npm run ios:add` again.

## Open in Xcode and run
```bash
npm run ios:sync
npm run ios:open
```
In Xcode:
1. Click **App** (blue icon, top of the left sidebar) → target **App** → **Signing & Capabilities**.
2. Tick **Automatically manage signing**, and under **Team** choose your Apple ID (add it first in Xcode → Settings → Accounts). If the bundle identifier `com.masonmagle.jellydash` is rejected as taken, change it to something unique, such as `com.yourname.jellydash`.
3. Under **General → Deployment Info**, tick every iPad orientation (the game turns itself to fit either way) and, if offered, tick **Requires full screen**.
4. Plug in the iPad and unlock it. Pick it in the device menu at the top of Xcode, then press **Run** (▶).
5. First launch only: on the iPad, Settings → General → VPN & Device Management → your Apple ID → **Trust**. Then open the app.

## After you change the game
Edit the files in `js/` or `index.html`, then run `npm run ios:sync` and press Run again.

## Notes
- The offline worker (`sw.js`) is not bundled. Everything is already inside the app, so it isn't needed.
- Only game files go into the app (see `prep-web.js`); tests and docs stay out.
- Not tested yet on a real iPad: touch feel, sound start after the first tap, and the notch and home-bar spacing. Report anything that looks off.
