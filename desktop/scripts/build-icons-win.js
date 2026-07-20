const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');

const desktopDir = path.join(__dirname, '..');
const source = path.join(desktopDir, 'assets', 'cinegen-icon.png');
const target = path.join(desktopDir, 'assets', 'cinegen.ico');

if (!fs.existsSync(source)) throw new Error(`Missing icon source: ${source}`);
const output = png2icons.createICO(fs.readFileSync(source), png2icons.BICUBIC, 0, false);
if (!output) throw new Error('Failed to compile CineGen ICO');
fs.writeFileSync(target, output);
console.log(`Created ${target}`);
