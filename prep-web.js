// Copies just the game files into www/ so the iOS app bundles the game and nothing else (no tests, no node_modules, no service worker).
// Run through `npm run prep` (or `npm run ios:sync`). Needs Node 16.7 or newer.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const out = path.join(root, 'www');
const files = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const dirs = ['js'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) { console.error('Missing ' + f + ' (run this from the repo root).'); process.exit(1); }
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
for (const d of dirs) {
  if (!fs.existsSync(path.join(root, d))) { console.error('Missing folder ' + d + ' (run this from the repo root).'); process.exit(1); }
  fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
}
console.log('www/ ready: ' + files.length + ' files + ' + dirs.join(', ') + '/');
