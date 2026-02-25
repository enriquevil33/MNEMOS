const BaseService = require('./base-service');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

/**
 * Flask Service Manager
 * Manages the Flask backend application
 */
class FlaskService extends BaseService {
  constructor(pythonPath, appPath, logsDir, port, environment) {
    super('Flask', pythonPath, appPath, logsDir);
    this.port = port;
    this.environment = environment;
    this.pythonExe = path.join(pythonPath, 'python.exe');
    this.pipExe = path.join(pythonPath, 'Scripts', 'pip.exe');
    this.appPath = appPath;
    this.requirementsInstalled = false;
  }

  /**
   * Check if requirements are installed
   */
  async checkRequirements() {
    const markerFile = path.join(this.appPath, '.requirements_installed');

    if (fs.existsSync(markerFile)) {
      log.info('Python requirements already installed');
      this.requirementsInstalled = true;
      return true;
    }

    return false;
  }

  /**
   * Install Python dependencies
   */
  async installDependencies() {
    if (await this.checkRequirements()) {
      return;
    }

    log.info('Installing Python dependencies...');

    const requirementsPath = path.join(this.appPath, 'requirements.txt');

    if (!fs.existsSync(requirementsPath)) {
      throw new Error('requirements.txt not found');
    }

    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');

      const proc = spawn(
        this.pipExe,
        ['install', '--no-cache-dir', '-r', requirementsPath],
        {
          cwd: this.appPath,
          windowsHide: true,
          stdio: 'pipe'
        }
      );

      let output = '';

      proc.stdout.on('data', (data) => {
        const msg = data.toString();
        output += msg;
        log.info(`[PIP] ${msg.trim()}`);
      });

      proc.stderr.on('data', (data) => {
        const msg = data.toString();
        output += msg;
        log.warn(`[PIP] ${msg.trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          // Create marker file
          fs.writeFileSync(
            path.join(this.appPath, '.requirements_installed'),
            new Date().toISOString(),
            'utf8'
          );
          this.requirementsInstalled = true;
          log.info('Python dependencies installed successfully');
          resolve();
        } else {
          log.error('Failed to install Python dependencies:', output);
          reject(new Error(`pip install failed with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        log.error('pip install error:', error);
        reject(error);
      });
    });
  }

  /**
   * Initialize database (run migrations if needed)
   */
  async initializeDatabase() {
    log.info('Initializing database...');

    // Flask app will auto-create tables via SQLAlchemy's db.create_all()
    // No migrations needed for first run
  }

  /**
   * Start Flask application
   */
  async start() {
    // Check if port is already in use
    if (await this.isPortInUse(this.port)) {
      throw new Error(`Port ${this.port} is already in use`);
    }

    // Install dependencies if needed
    await this.installDependencies();

    // Initialize database
    await this.initializeDatabase();

    // Prepare environment
    const env = {
      ...process.env,
      ...this.environment,
      PYTHONPATH: this.appPath,
      PYTHONUNBUFFERED: '1'
    };

    // Create uploads directory if not exists
    const uploadsDir = env.UPLOAD_FOLDER || path.join(this.appPath, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Start Flask with Gunicorn (or flask run for dev)
    const isWindows = process.platform === 'win32';

    // On Windows, we'll use flask run since Gunicorn doesn't support Windows
    const args = [
      '-m', 'flask',
      'run',
      '--host', '0.0.0.0',
      '--port', this.port.toString()
    ];

    this.spawnProcess(
      this.pythonExe,
      args,
      {
        cwd: this.appPath,
        env: env
      }
    );

    // Wait for Flask to be ready
    await this.waitForReady(async () => {
      // Check if Flask is responding
      try {
        const fetch = require('node-fetch');
        const response = await fetch(`http://localhost:${this.port}/`, {
          timeout: 2000
        });
        return response.ok || response.status === 404; // 404 is OK, means server is up
      } catch (error) {
        return false;
      }
    }, 60, 1000);

    log.info('Flask is ready');
  }

  /**
   * Get application URL
   */
  getUrl() {
    return `http://localhost:${this.port}`;
  }
}

module.exports = FlaskService;
