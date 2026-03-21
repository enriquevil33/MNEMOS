const BaseService = require('./base-service');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

/**
 * Redis Service Manager
 * Manages embedded Redis server
 */
class RedisService extends BaseService {
  constructor(binPath, dataDir, logsDir, port = 6379) {
    super('Redis', binPath, dataDir, logsDir);
    this.port = port;
    this.redisBinPath = path.join(binPath, 'redis-server.exe');
    this.configFile = path.join(dataDir, 'redis.conf');
  }

  /**
   * Create Redis configuration
   */
  createConfig() {
    const config = `
# MNEMOS Redis Configuration
port ${this.port}
bind 127.0.0.1
protected-mode yes

# Persistence
dir "${this.dataDir.replace(/\\/g, '/')}"
dbfilename dump.rdb
save 900 1
save 300 10
save 60 10000

# AOF persistence
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Logging
loglevel notice
logfile "${path.join(this.logsDir, 'redis.log').replace(/\\/g, '/')}"

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Performance
timeout 300
tcp-keepalive 300
`;

    fs.writeFileSync(this.configFile, config, 'utf8');
    log.info('Redis configuration created');
  }

  /**
   * Start Redis server
   */
  async start() {
    // Check if port is already in use
    if (await this.isPortInUse(this.port)) {
      throw new Error(`Port ${this.port} is already in use`);
    }

    // Create config
    this.createConfig();

    // Start Redis
    this.spawnProcess(
      this.redisBinPath,
      [this.configFile],
      {
        cwd: this.dataDir
      }
    );

    // Wait for Redis to be ready
    await this.waitForReady(async () => {
      return await this.isPortInUse(this.port);
    }, 30, 500);

    log.info('Redis is ready');
  }

  /**
   * Get connection URL
   */
  getConnectionUrl() {
    return `redis://localhost:${this.port}/0`;
  }
}

module.exports = RedisService;
