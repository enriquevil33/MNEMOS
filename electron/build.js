#!/usr/bin/env node

/**
 * MNEMOS Build Script
 * Builds the complete Electron application with all dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  log(`> ${command}`, colors.blue);
  try {
    execSync(command, {
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    log(`✗ Command failed: ${command}`, colors.red);
    process.exit(1);
  }
}

function checkPrerequisites() {
  log('\n=== Checking Prerequisites ===\n', colors.bright);

  // Check Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    log(`✓ Node.js: ${nodeVersion}`, colors.green);
  } catch {
    log('✗ Node.js is not installed', colors.red);
    process.exit(1);
  }

  // Check npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`✓ npm: ${npmVersion}`, colors.green);
  } catch {
    log('✗ npm is not installed', colors.red);
    process.exit(1);
  }

  // Check if Angular is built
  const angularDistPath = path.join(__dirname, '..', 'frontend_spa', 'dist');
  if (!fs.existsSync(angularDistPath)) {
    log('✗ Angular frontend not built. Please run "npm run build" in frontend_spa first.', colors.red);
    process.exit(1);
  }
  log('✓ Angular frontend is built', colors.green);
}

function installDependencies() {
  log('\n=== Installing Electron Dependencies ===\n', colors.bright);

  const electronPath = path.join(__dirname);
  exec('npm install', { cwd: electronPath });

  log('✓ Dependencies installed', colors.green);
}

function buildAngular() {
  log('\n=== Building Angular Frontend ===\n', colors.bright);

  const frontendPath = path.join(__dirname, '..', 'frontend_spa');

  if (!fs.existsSync(path.join(frontendPath, 'node_modules'))) {
    log('Installing Angular dependencies...', colors.yellow);
    exec('npm install', { cwd: frontendPath });
  }

  log('Building Angular for production...', colors.yellow);
  exec('npm run build', { cwd: frontendPath });

  log('✓ Angular frontend built', colors.green);
}

function buildElectron(target = 'nsis') {
  log('\n=== Building Electron Application ===\n', colors.bright);

  const electronPath = path.join(__dirname);

  let buildCommand = 'npm run build';
  if (target === 'portable') {
    buildCommand = 'npm run build:portable';
  }

  log(`Building ${target} installer...`, colors.yellow);
  exec(buildCommand, { cwd: electronPath });

  log('✓ Electron application built', colors.green);
}

function showResults() {
  log('\n=== Build Complete! ===\n', colors.bright);

  const distPath = path.join(__dirname, 'dist');

  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath).filter(f => f.endsWith('.exe'));

    if (files.length > 0) {
      log('Built installers:', colors.green);
      files.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        log(`  - ${file} (${sizeMB} MB)`, colors.yellow);
      });

      log('\n✓ Installation files are ready for distribution!', colors.green);
      log(`Location: ${distPath}`, colors.blue);
    }
  }
}

// Main build process
async function main() {
  const args = process.argv.slice(2);
  const buildType = args[0] || 'nsis';

  log('\n╔═══════════════════════════════════════╗', colors.bright);
  log('║   MNEMOS Electron Build System       ║', colors.bright);
  log('╚═══════════════════════════════════════╝\n', colors.bright);

  try {
    checkPrerequisites();
    installDependencies();

    // Build Angular if needed
    if (!fs.existsSync(path.join(__dirname, '..', 'frontend_spa', 'dist'))) {
      buildAngular();
    }

    buildElectron(buildType);
    showResults();

    log('\n✓ All done! 🎉\n', colors.green);

  } catch (error) {
    log(`\n✗ Build failed: ${error.message}\n`, colors.red);
    process.exit(1);
  }
}

main();
