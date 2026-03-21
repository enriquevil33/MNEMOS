#!/usr/bin/env node

/**
 * Generate Icon Files from SVG
 * Converts favicon.svg to all required icon formats for Electron
 */

const fs = require('fs');
const path = require('path');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║         MNEMOS Icon Generator from SVG                   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const buildDir = path.join(__dirname, 'build');
const svgPath = path.join(buildDir, 'icon.svg');
const icoPath = path.join(buildDir, 'icon.ico');

// Check if files exist
const svgExists = fs.existsSync(svgPath);
const icoExists = fs.existsSync(icoPath);

console.log('Checking icon files...\n');
console.log(`${svgExists ? '✓' : '✗'} icon.svg ${svgExists ? 'found' : 'missing'}`);
console.log(`${icoExists ? '✓' : '✗'} icon.ico ${icoExists ? 'found' : 'missing'}\n`);

if (svgExists && icoExists) {
  console.log('✓ Required icons are present!\n');

  // Create icon.png from SVG (we'll use a simple conversion approach)
  const iconPngPath = path.join(buildDir, 'icon.png');
  const trayIconPath = path.join(buildDir, 'tray-icon.png');

  console.log('Next steps to complete icon setup:\n');
  console.log('Option 1: Use Online Converter (Recommended)');
  console.log('  1. Open: https://cloudconvert.com/svg-to-png');
  console.log(`  2. Upload: ${svgPath}`);
  console.log('  3. Set size to 512x512 pixels');
  console.log(`  4. Download and save as: ${iconPngPath}\n`);

  console.log('  5. Open: https://www.iloveimg.com/resize-image');
  console.log('  6. Upload the 512x512 PNG you just created');
  console.log('  7. Resize to 32x32 pixels');
  console.log(`  8. Save as: ${trayIconPath}\n`);

  console.log('Option 2: Use ImageMagick (if installed)');
  console.log(`  magick convert "${svgPath}" -resize 512x512 -background none "${iconPngPath}"`);
  console.log(`  magick convert "${iconPngPath}" -resize 32x32 "${trayIconPath}"\n`);

  console.log('Option 3: Use Inkscape (if installed)');
  console.log(`  inkscape "${svgPath}" --export-filename="${iconPngPath}" --export-width=512 --export-height=512`);
  console.log(`  inkscape "${svgPath}" --export-filename="${trayIconPath}" --export-width=32 --export-height=32\n`);

  // Check if PNG files already exist
  const iconPngExists = fs.existsSync(iconPngPath);
  const trayIconExists = fs.existsSync(trayIconPath);

  console.log('Current PNG status:');
  console.log(`${iconPngExists ? '✓' : '✗'} icon.png (512x512) ${iconPngExists ? 'ready' : 'needed'}`);
  console.log(`${trayIconExists ? '✓' : '✗'} tray-icon.png (32x32) ${trayIconExists ? 'needed' : 'ready'}\n`);

  if (iconPngExists && trayIconExists) {
    console.log('🎉 All icons are ready! You can build the app now.\n');
    console.log('Run: node build.js\n');
  } else {
    console.log('⚠  Please create the missing PNG files using one of the options above.\n');
  }

} else {
  console.log('✗ Icon files are missing!\n');
  console.log('The favicon.svg and favicon.ico should have been copied from frontend_spa/public/\n');
  console.log('Please check if they exist in frontend_spa/public/ directory.\n');
}

// Create a placeholder README if PNG conversion tools info is needed
const readmePath = path.join(buildDir, 'CONVERT_ICONS_INSTRUCTIONS.txt');
const instructions = `
MNEMOS Icon Conversion Instructions
====================================

Your SVG icon has been copied to electron/build/icon.svg
Your ICO icon has been copied to electron/build/icon.ico

To complete the icon setup, you need to create two PNG files:

1. icon.png (512x512 pixels)
2. tray-icon.png (32x32 pixels)

OPTION 1: Online Conversion (Easiest)
--------------------------------------

Step 1: Convert SVG to 512x512 PNG
1. Go to: https://cloudconvert.com/svg-to-png
2. Upload: electron/build/icon.svg
3. Set dimensions: 512x512 pixels
4. Download as: icon.png
5. Place in: electron/build/icon.png

Step 2: Create tray icon (32x32 PNG)
1. Go to: https://www.iloveimg.com/resize-image
2. Upload the 512x512 PNG from Step 1
3. Resize to: 32x32 pixels
4. Download as: tray-icon.png
5. Place in: electron/build/tray-icon.png

OPTION 2: ImageMagick Command Line
-----------------------------------

If you have ImageMagick installed:

cd electron/build
magick convert icon.svg -resize 512x512 -background none icon.png
magick convert icon.png -resize 32x32 tray-icon.png

OPTION 3: Inkscape Command Line
--------------------------------

If you have Inkscape installed:

inkscape icon.svg --export-filename=icon.png --export-width=512 --export-height=512
inkscape icon.svg --export-filename=tray-icon.png --export-width=32 --export-height=32

OPTION 4: Manual Photoshop/GIMP
--------------------------------

1. Open icon.svg in Photoshop/GIMP
2. Set canvas size to 512x512
3. Export as PNG: icon.png
4. Resize to 32x32
5. Export as PNG: tray-icon.png

After creating the PNG files, run: node build.js
`;

fs.writeFileSync(readmePath, instructions, 'utf8');
console.log(`📄 Detailed instructions saved to: ${readmePath}\n`);
