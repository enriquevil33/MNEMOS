const BaseService = require('./base-service');
const path = require('path');
const log = require('electron-log');

/**
 * Celery Service Manager
 * Manages the Celery worker for async tasks
 */
class CeleryService extends BaseService {
  constructor(pythonPath, appPath, logsDir, environment) {
    super('Celery', pythonPath, appPath, logsDir);
    this.environment = environment;
    this.pythonExe = path.join(pythonPath, 'python.exe');
    this.appPath = appPath;
  }

  /**
   * Start Celery worker
   */
  async start() {
    log.info('Starting Celery worker...');

    // Prepare environment
    const env = {
      ...process.env,
      ...this.environment,
      PYTHONPATH: this.appPath,
      PYTHONUNBUFFERED: '1',
      FORKED_BY_MULTIPROCESSING: '1'
    };

    // Start Celery worker
    // Using --pool=solo for Windows compatibility (gevent/eventlet not needed for simple tasks)
    const args = [
      '-m', 'celery',
      '-A', 'app.celery_app',
      'worker',
      '--loglevel=info',
      '--pool=solo',
      '--concurrency=1'
    ];

    this.spawnProcess(
      this.pythonExe,
      args,
      {
        cwd: this.appPath,
        env: env
      }
    );

    // Wait for Celery to be ready (check log output)
    await this.waitForReady(async () => {
      // Check if "ready" message appears in logs
      const logs = this.getLogs();
      return logs.includes('ready') || logs.includes('celery@') || this.logBuffer.length > 5;
    }, 30, 1000);

    log.info('Celery worker is ready');
  }
}

module.exports = CeleryService;
