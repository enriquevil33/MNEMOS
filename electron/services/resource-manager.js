const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const log = require('electron-log');
const extractZip = require('extract-zip');
const tar = require('tar');

/**
 * Resource Manager
 * Handles downloading and managing embedded binaries (PostgreSQL, Redis, Python)
 */
class ResourceManager {
  constructor(resourcesPath, userDataPath) {
    this.resourcesPath = resourcesPath;
    this.userDataPath = userDataPath;
    this.downloadsPath = path.join(userDataPath, 'downloads');
    this.binariesPath = path.join(userDataPath, 'binaries');

    // Ensure directories exist
    [this.downloadsPath, this.binariesPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Resource definitions
    this.resources = {
      postgresql: {
        name: 'PostgreSQL',
        version: '16.2',
        url: 'https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64-binaries.zip',
        extractPath: 'pgsql',
        checkFile: 'bin/postgres.exe'
      },
      redis: {
        name: 'Redis',
        version: '5.0.14.1',
        url: 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip',
        extractPath: 'redis',
        checkFile: 'redis-server.exe'
      },
      python: {
        name: 'Python',
        version: '3.11.9',
        url: 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip',
        extractPath: 'python',
        checkFile: 'python.exe',
        postExtract: async (extractedPath) => {
          // Setup Python environment
          await this.setupPython(extractedPath);
        }
      }
    };
  }

  /**
   * Ensure all required resources are available
   */
  async ensureResourcesAvailable(progressCallback) {
    log.info('Checking required resources...');

    const resourceKeys = Object.keys(this.resources);
    let completedCount = 0;

    for (const key of resourceKeys) {
      const resource = this.resources[key];
      const targetPath = path.join(this.binariesPath, resource.extractPath);

      // Check if already exists
      if (this.isResourceAvailable(key)) {
        log.info(`${resource.name} is already available`);
        completedCount++;
        if (progressCallback) {
          progressCallback(completedCount / resourceKeys.length);
        }
        continue;
      }

      // Download and extract
      log.info(`${resource.name} not found, downloading...`);

      try {
        await this.downloadAndExtract(resource, targetPath, (progress) => {
          const overallProgress = (completedCount + progress) / resourceKeys.length;
          if (progressCallback) {
            progressCallback(overallProgress);
          }
        });

        completedCount++;
        if (progressCallback) {
          progressCallback(completedCount / resourceKeys.length);
        }

        log.info(`${resource.name} downloaded and extracted successfully`);
      } catch (error) {
        log.error(`Failed to download ${resource.name}:`, error);
        throw new Error(`Failed to download ${resource.name}: ${error.message}`);
      }
    }

    log.info('All resources are available');
    return true;
  }

  /**
   * Check if a resource is available
   */
  isResourceAvailable(resourceKey) {
    const resource = this.resources[resourceKey];
    const targetPath = path.join(this.binariesPath, resource.extractPath);
    const checkPath = path.join(targetPath, resource.checkFile);
    return fs.existsSync(checkPath);
  }

  /**
   * Download and extract a resource
   */
  async downloadAndExtract(resource, targetPath, progressCallback) {
    const fileName = path.basename(resource.url);
    const downloadPath = path.join(this.downloadsPath, fileName);

    // Download if not already downloaded
    if (!fs.existsSync(downloadPath)) {
      await this.downloadFile(resource.url, downloadPath, progressCallback);
    } else {
      log.info(`Using cached download: ${fileName}`);
    }

    // Extract
    log.info(`Extracting ${fileName}...`);
    await this.extractArchive(downloadPath, targetPath);

    // Run post-extract if defined
    if (resource.postExtract) {
      log.info(`Running post-extract for ${resource.name}...`);
      await resource.postExtract(targetPath);
    }

    // Clean up download (optional - keep for re-installs)
    // fs.unlinkSync(downloadPath);
  }

  /**
   * Download a file with progress
   */
  downloadFile(url, destPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      log.info(`Downloading from ${url}`);

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          return this.downloadFile(response.headers.location, destPath, progressCallback)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        const fileStream = fs.createWriteStream(destPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (progressCallback && totalSize) {
            const progress = downloadedSize / totalSize;
            progressCallback(progress * 0.8); // 80% for download, 20% for extract
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          log.info(`Downloaded successfully: ${destPath}`);
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      request.setTimeout(300000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Extract archive (zip or tar.gz)
   */
  async extractArchive(archivePath, targetPath) {
    const ext = path.extname(archivePath).toLowerCase();

    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    if (ext === '.zip') {
      await extractZip(archivePath, { dir: targetPath });
    } else if (ext === '.gz' || archivePath.endsWith('.tar.gz')) {
      await tar.extract({
        file: archivePath,
        cwd: targetPath
      });
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }

    log.info(`Extracted to ${targetPath}`);
  }

  /**
   * Setup Python embedded distribution
   */
  async setupPython(pythonPath) {
    log.info('Setting up Python environment...');

    // Create python311._pth file to enable site-packages
    const pthFile = path.join(pythonPath, 'python311._pth');
    const pthContent = `python311.zip
.
Lib
Lib\\site-packages

# Uncomment to run site.main() automatically
import site
`;
    fs.writeFileSync(pthFile, pthContent, 'utf8');

    // Download and install pip
    const getpipPath = path.join(pythonPath, 'get-pip.py');

    if (!fs.existsSync(getpipPath)) {
      log.info('Downloading get-pip.py...');
      await this.downloadFile(
        'https://bootstrap.pypa.io/get-pip.py',
        getpipPath,
        null
      );
    }

    // Install pip
    log.info('Installing pip...');
    const { execSync } = require('child_process');
    const pythonExe = path.join(pythonPath, 'python.exe');

    try {
      execSync(`"${pythonExe}" "${getpipPath}"`, {
        cwd: pythonPath,
        windowsHide: true,
        stdio: 'pipe'
      });
      log.info('pip installed successfully');
    } catch (error) {
      log.warn('pip installation encountered an issue (may already be installed)');
    }

    // Create Scripts directory if it doesn't exist
    const scriptsDir = path.join(pythonPath, 'Scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    log.info('Python setup complete');
  }

  /**
   * Get paths to all resources
   */
  getResourcePaths() {
    const paths = {};
    for (const [key, resource] of Object.entries(this.resources)) {
      paths[key] = path.join(this.binariesPath, resource.extractPath);
    }
    return paths;
  }

  /**
   * Clean up downloads
   */
  cleanupDownloads() {
    if (fs.existsSync(this.downloadsPath)) {
      fs.rmSync(this.downloadsPath, { recursive: true, force: true });
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }
    log.info('Downloads cleaned up');
  }
}

module.exports = ResourceManager;
