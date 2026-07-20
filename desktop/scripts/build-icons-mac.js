const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');

const desktopDir = path.join(__dirname, '..');
const source = path.join(desktopDir, 'assets', 'cinegen-icon.png');
const target = path.join(desktopDir, 'assets', 'cinegen.icns');

if (!fs.existsSync(source)) throw new Error(`Missing icon source: ${source}`);
const output = png2icons.createICNS(fs.readFileSync(source), png2icons.BICUBIC, 0);
if (!output) throw new Error('Failed to compile CineGen ICNS');
fs.writeFileSync(target, output);
console.log(`Created ${target}`);
