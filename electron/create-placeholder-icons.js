#!/usr/bin/env node

/**
 * Create Placeholder Icons for MNEMOS
 * This creates simple placeholder icons until you add your brand icons
 */

const fs = require('fs');
const path = require('path');

console.log('Creating placeholder icon instructions...\n');

const instructions = `
╔═════════════════════════════════════════════════════════════════╗
║                   MNEMOS Icon Setup Required                    ║
╚═════════════════════════════════════════════════════════════════╝

The Electron build requires the following icon files:

📁 electron/build/
  ├── icon.ico      (Windows app icon - 256x256)
  ├── icon.png      (Cross-platform icon - 512x512)
  └── tray-icon.png (System tray icon - 32x32)

┌─────────────────────────────────────────────────────────────────┐
│ Option 1: Quick Online Conversion (Recommended)                │
└─────────────────────────────────────────────────────────────────┘

1. Create your logo as a PNG (512x512 px, transparent background)

2. Convert to .ico:
   → Go to: https://convertico.com/
   → Upload your PNG
   → Download icon.ico
   → Save to: electron/build/icon.ico

3. Create icon.png:
   → Just copy your 512x512 PNG to electron/build/icon.png

4. Create tray-icon.png:
   → Go to: https://www.iloveimg.com/resize-image
   → Resize to 32x32 pixels
   → Save to: electron/build/tray-icon.png

┌─────────────────────────────────────────────────────────────────┐
│ Option 2: Use ImageMagick (Advanced)                           │
└─────────────────────────────────────────────────────────────────┘

If you have ImageMagick installed:

  # Convert PNG to multi-size ICO
  magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

  # Create tray icon
  magick convert logo.png -resize 32x32 tray-icon.png

┌─────────────────────────────────────────────────────────────────┐
│ Option 3: Temporary Placeholder                                │
└─────────────────────────────────────────────────────────────────┘

For testing, you can use any image temporarily:
1. Find any PNG image
2. Rename it to icon.png and place in electron/build/
3. Use online converter to create icon.ico from it
4. Create 32x32 version for tray-icon.png

The build will work with placeholder icons, but replace them before
distributing to users!

┌─────────────────────────────────────────────────────────────────┐
│ Icon Design Tips                                                │
└─────────────────────────────────────────────────────────────────┘

✓ Use high contrast for tray icon (simple, recognizable)
✓ Test on both light and dark Windows themes
✓ Keep tray icon monochrome for best results
✓ Use transparency in PNG files
✓ Avoid fine details that won't scale well

┌─────────────────────────────────────────────────────────────────┐
│ Current Status                                                  │
└─────────────────────────────────────────────────────────────────┘
`;

console.log(instructions);

// Check if icons exist
const buildDir = path.join(__dirname, 'build');
const requiredIcons = ['icon.ico', 'icon.png', 'tray-icon.png'];

let allIconsExist = true;

requiredIcons.forEach(icon => {
  const iconPath = path.join(buildDir, icon);
  const exists = fs.existsSync(iconPath);
  const status = exists ? '✓ Found' : '✗ Missing';
  const color = exists ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${status}\x1b[0m  ${icon}`);

  if (!exists) allIconsExist = false;
});

console.log();

if (allIconsExist) {
  console.log('\x1b[32m✓ All icons are present! You can build the app.\x1b[0m\n');
} else {
  console.log('\x1b[33m⚠ Some icons are missing. Please add them before building.\x1b[0m');
  console.log('\x1b[33m  You can still build with placeholder icons for testing.\x1b[0m\n');
}

console.log('Next steps:');
console.log('  1. Add your icons to electron/build/');
console.log('  2. Run: node build.js');
console.log('  3. Test: electron/dist/MNEMOS-Setup-1.0.0.exe');
console.log();
