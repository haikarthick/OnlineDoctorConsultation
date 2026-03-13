/**
 * PWA Icon Generator
 * Run: node generate-icons.js
 * Generates PNG icons from the SVG template for PWA manifest.
 * Requires: sharp (npm i -D sharp)
 */
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'public', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');
const SIZES = [192, 512];

async function generate() {
  try {
    const sharp = require('sharp');
    const svgBuffer = fs.readFileSync(SVG_PATH);

    for (const size of SIZES) {
      const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${outputPath}`);
    }
    console.log('All icons generated successfully!');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('sharp not installed. Installing...');
      const { execSync } = require('child_process');
      execSync('npm install --save-dev sharp', { stdio: 'inherit', cwd: __dirname });
      console.log('sharp installed. Run this script again.');
    } else {
      console.error('Error generating icons:', err.message);
    }
  }
}

generate();
