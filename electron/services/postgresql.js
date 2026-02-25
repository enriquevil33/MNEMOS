const BaseService = require('./base-service');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const log = require('electron-log');

/**
 * PostgreSQL Service Manager
 * Manages embedded PostgreSQL server with pgvector extension
 */
class PostgreSQLService extends BaseService {
  constructor(binPath, dataDir, logsDir, port = 5432) {
    super('PostgreSQL', binPath, dataDir, logsDir);
    this.port = port;
    this.pgBinPath = path.join(binPath, 'bin');
    this.pgDataDir = path.join(dataDir, 'pgdata');
    this.username = 'mnemos';
    this.password = 'mnemos';
    this.database = 'mnemos_db';
  }

  /**
   * Initialize database if not exists
   */
  async initDatabase() {
    if (fs.existsSync(path.join(this.pgDataDir, 'PG_VERSION'))) {
      log.info('PostgreSQL data directory already exists');
      return;
    }

    log.info('Initializing PostgreSQL data directory...');

    const initdbPath = path.join(this.pgBinPath, 'initdb.exe');

    try {
      execSync(
        `"${initdbPath}" -D "${this.pgDataDir}" -U ${this.username} -E UTF8 -A trust --no-locale`,
        {
          windowsHide: true,
          stdio: 'pipe'
        }
      );
      log.info('PostgreSQL initialized successfully');
    } catch (error) {
      log.error('Failed to initialize PostgreSQL:', error);
      throw new Error(`PostgreSQL initialization failed: ${error.message}`);
    }

    // Create postgresql.conf with custom settings
    this.createConfig();
  }

  /**
   * Create PostgreSQL configuration
   */
  createConfig() {
    const configPath = path.join(this.pgDataDir, 'postgresql.conf');

    const config = `
# MNEMOS PostgreSQL Configuration
port = ${this.port}
listen_addresses = 'localhost'
max_connections = 100

# Memory settings
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 128MB
effective_cache_size = 512MB

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = '${this.logsDir.replace(/\\/g, '/')}'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'none'
log_duration = off
log_line_prefix = '%t [%p] %u@%d '

# Connection settings
unix_socket_directories = ''

# Locale
lc_messages = 'C'
lc_monetary = 'C'
lc_numeric = 'C'
lc_time = 'C'

# Extensions
shared_preload_libraries = 'vector'
`;

    fs.writeFileSync(configPath, config, 'utf8');
    log.info('PostgreSQL configuration created');
  }

  /**
   * Start PostgreSQL server
   */
  async start() {
    // Check if port is already in use
    if (await this.isPortInUse(this.port)) {
      throw new Error(`Port ${this.port} is already in use`);
    }

    // Initialize database if needed
    await this.initDatabase();

    // Start PostgreSQL
    const pgCtlPath = path.join(this.pgBinPath, 'pg_ctl.exe');
    const postgresPath = path.join(this.pgBinPath, 'postgres.exe');

    this.spawnProcess(
      postgresPath,
      [
        '-D', this.pgDataDir,
        '-p', this.port.toString()
      ],
      {
        env: {
          ...process.env,
          PATH: `${this.pgBinPath};${process.env.PATH}`,
          PGDATA: this.pgDataDir
        }
      }
    );

    // Wait for PostgreSQL to be ready
    await this.waitForReady(async () => {
      return await this.isPortInUse(this.port);
    }, 30, 1000);

    log.info('PostgreSQL is ready');

    // Create database and user if first run
    await this.setupDatabase();
  }

  /**
   * Setup database, user, and extensions
   */
  async setupDatabase() {
    const psqlPath = path.join(this.pgBinPath, 'psql.exe');

    // Small delay to ensure server is fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Create database if not exists
      execSync(
        `"${psqlPath}" -U ${this.username} -p ${this.port} -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${this.database}'" | findstr "1" || "${psqlPath}" -U ${this.username} -p ${this.port} -d postgres -c "CREATE DATABASE ${this.database}"`,
        {
          windowsHide: true,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH: `${this.pgBinPath};${process.env.PATH}`,
            PGPASSWORD: this.password
          }
        }
      );

      // Install pgvector extension
      execSync(
        `"${psqlPath}" -U ${this.username} -p ${this.port} -d ${this.database} -c "CREATE EXTENSION IF NOT EXISTS vector"`,
        {
          windowsHide: true,
          stdio: 'pipe',
          env: {
            ...process.env,
            PATH: `${this.pgBinPath};${process.env.PATH}`,
            PGPASSWORD: this.password
          }
        }
      );

      log.info('Database and extensions setup complete');
    } catch (error) {
      log.warn('Database setup encountered an issue (may already exist):', error.message);
      // Non-fatal - database may already exist
    }
  }

  /**
   * Stop PostgreSQL server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping PostgreSQL...');

    const pgCtlPath = path.join(this.pgBinPath, 'pg_ctl.exe');

    try {
      execSync(
        `"${pgCtlPath}" stop -D "${this.pgDataDir}" -m fast`,
        {
          windowsHide: true,
          timeout: 10000,
          env: {
            ...process.env,
            PATH: `${this.pgBinPath};${process.env.PATH}`
          }
        }
      );
      log.info('PostgreSQL stopped gracefully');
    } catch (error) {
      log.error('Error stopping PostgreSQL gracefully, forcing...', error);
      await super.stop();
    }

    this.cleanup();
  }

  /**
   * Get connection string
   */
  getConnectionString() {
    return `postgresql://${this.username}:${this.password}@localhost:${this.port}/${this.database}`;
  }
}

module.exports = PostgreSQLService;
