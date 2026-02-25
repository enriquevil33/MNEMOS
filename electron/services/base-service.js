const { spawn } = require('child_process');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');
const treeKill = require('tree-kill');

/**
 * Base class for all system services
 */
class BaseService {
  constructor(name, binPath, dataDir, logsDir) {
    this.name = name;
    this.binPath = binPath;
    this.dataDir = dataDir;
    this.logsDir = logsDir;
    this.process = null;
    this.isRunning = false;
    this.startTime = null;
    this.logBuffer = [];
    this.maxLogLines = 1000;

    // Ensure directories exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Start the service - override in subclass
   */
  async start() {
    throw new Error('start() must be implemented by subclass');
  }

  /**
   * Stop the service
   */
  async stop() {
    if (!this.process || !this.isRunning) {
      log.info(`${this.name} is not running`);
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.warn(`${this.name} did not stop gracefully, forcing...`);
        treeKill(this.process.pid, 'SIGKILL', (err) => {
          if (err) {
            log.error(`Failed to kill ${this.name}:`, err);
          }
          this.cleanup();
          resolve();
        });
      }, 10000); // 10 second timeout

      treeKill(this.process.pid, 'SIGTERM', (err) => {
        clearTimeout(timeout);
        if (err) {
          log.error(`Error stopping ${this.name}:`, err);
          reject(err);
        } else {
          log.info(`${this.name} stopped successfully`);
          this.cleanup();
          resolve();
        }
      });
    });
  }

  /**
   * Cleanup after process stops
   */
  cleanup() {
    this.isRunning = false;
    this.process = null;
    this.startTime = null;
  }

  /**
   * Spawn a process with logging
   */
  spawnProcess(command, args, options = {}) {
    log.info(`Starting ${this.name}: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      ...options,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Setup logging
    const logFile = path.join(this.logsDir, `${this.name}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    proc.stdout.on('data', (data) => {
      const msg = data.toString();
      this.addToBuffer(msg);
      logStream.write(msg);
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      this.addToBuffer(`[ERROR] ${msg}`);
      logStream.write(`[ERROR] ${msg}`);
    });

    proc.on('error', (error) => {
      log.error(`${this.name} process error:`, error);
      this.isRunning = false;
    });

    proc.on('exit', (code, signal) => {
      log.info(`${this.name} exited with code ${code}, signal ${signal}`);
      logStream.end();
      this.isRunning = false;
    });

    this.process = proc;
    this.isRunning = true;
    this.startTime = Date.now();

    return proc;
  }

  /**
   * Add log line to buffer
   */
  addToBuffer(line) {
    this.logBuffer.push({
      timestamp: new Date().toISOString(),
      message: line.trim()
    });

    // Keep buffer size limited
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer.shift();
    }
  }

  /**
   * Get recent logs
   */
  getLogs(lines = 100) {
    const recentLogs = this.logBuffer.slice(-lines);
    return recentLogs.map(entry => `[${entry.timestamp}] ${entry.message}`).join('\n');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.isRunning,
      pid: this.process ? this.process.pid : null,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      startTime: this.startTime
    };
  }

  /**
   * Wait for process to be ready (check file/port/etc)
   */
  async waitForReady(checkFn, maxRetries = 30, retryDelay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      if (!this.isRunning) {
        throw new Error(`${this.name} stopped unexpectedly`);
      }

      const ready = await checkFn();
      if (ready) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error(`${this.name} did not become ready within timeout`);
  }

  /**
   * Check if port is in use
   */
  async isPortInUse(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const tester = net.createServer()
        .once('error', () => resolve(true))
        .once('listening', () => {
          tester.once('close', () => resolve(false)).close();
        })
        .listen(port, '127.0.0.1');
    });
  }
}

module.exports = BaseService;
