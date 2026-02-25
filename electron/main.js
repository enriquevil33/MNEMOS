const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, shell } = require('electron');
const path = require('path');
const log = require('electron-log');
const Store = require('electron-store');
const fs = require('fs');

// Service managers
const PostgreSQLService = require('./services/postgresql');
const RedisService = require('./services/redis');
const FlaskService = require('./services/flask');
const CeleryService = require('./services/celery');
const ResourceManager = require('./services/resource-manager');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Store for persistent settings
const store = new Store({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    firstRun: true,
    services: {
      postgresql: { port: 5432 },
      redis: { port: 6379 },
      flask: { port: 5000 }
    }
  }
});

// Global references
let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

// Service instances
let services = {
  postgresql: null,
  redis: null,
  flask: null,
  celery: null
};

// Resource manager
let resourceManager = null;

// Determine if running in development mode
const isDev = process.argv.includes('--dev') || !app.isPackaged;

// Paths configuration
const paths = {
  app: isDev
    ? path.join(__dirname, '..')
    : path.join(process.resourcesPath, 'app'),
  resources: isDev
    ? path.join(__dirname, 'resources')
    : path.join(process.resourcesPath, 'resources'),
  userData: app.getPath('userData'),
  logs: path.join(app.getPath('userData'), 'logs'),
  models: path.join(app.getPath('userData'), 'models')
};

// Ensure directories exist
if (!fs.existsSync(paths.logs)) {
  fs.mkdirSync(paths.logs, { recursive: true });
}
if (!fs.existsSync(path.join(paths.userData, 'data'))) {
  fs.mkdirSync(path.join(paths.userData, 'data'), { recursive: true });
}
if (!fs.existsSync(paths.models)) {
  fs.mkdirSync(paths.models, { recursive: true });
  log.info('Created models folder at:', paths.models);

  // Create README.txt in models folder
  const readmeContent = `MNEMOS Models Folder
====================

This is where you place your .gguf model files for local LLM inference.

HOW TO ADD MODELS:
------------------

1. Download a GGUF model from Hugging Face
   Example: llama-2-7b-chat.Q4_K_M.gguf

2. Copy the .gguf file to this folder

3. The model will be available to MNEMOS automatically

RECOMMENDED MODELS:
-------------------

- Llama 2 7B Chat (Q4_K_M) - 4GB - General conversation
- Mistral 7B Instruct (Q4_K_M) - 4GB - Instruction following
- CodeLlama 7B (Q4_K_M) - 4GB - Code generation

WHERE TO DOWNLOAD:
------------------

Hugging Face: https://huggingface.co/models?library=gguf
Look for models by "TheBloke" - they are pre-quantized GGUF format

QUICK ACCESS:
-------------

Right-click the MNEMOS system tray icon → "Open Models Folder"

---
MNEMOS - AI-Powered Context & Memory System
`;

  fs.writeFileSync(path.join(paths.models, 'README.txt'), readmeContent, 'utf8');
}

log.info('=== MNEMOS Starting ===');
log.info('Development mode:', isDev);
log.info('App path:', paths.app);
log.info('Resources path:', paths.resources);
log.info('User data path:', paths.userData);

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn('Another instance is already running');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Create splash window
 */
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'ui', 'splash.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * Create main application window
 */
function createMainWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  // Save window bounds on resize/move
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  });

  mainWindow.on('move', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return mainWindow;
}

/**
 * Create system tray
 */
function createTray() {
  const iconPath = path.join(__dirname, 'build', 'tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MNEMOS',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Services Status',
      submenu: [
        { label: 'PostgreSQL: Starting...', enabled: false, id: 'postgresql-status' },
        { label: 'Redis: Starting...', enabled: false, id: 'redis-status' },
        { label: 'Flask: Starting...', enabled: false, id: 'flask-status' },
        { label: 'Celery: Starting...', enabled: false, id: 'celery-status' }
      ]
    },
    { type: 'separator' },
    {
      label: 'Open Models Folder',
      click: () => {
        shell.openPath(paths.models);
      },
      toolTip: 'Add your .gguf model files here'
    },
    {
      label: 'Open Logs Folder',
      click: () => {
        shell.openPath(paths.logs);
      }
    },
    {
      label: 'Open Data Folder',
      click: () => {
        shell.openPath(paths.userData);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        isQuitting = true;
        await shutdownServices();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('MNEMOS');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

/**
 * Update tray service status
 */
function updateTrayServiceStatus(service, status) {
  if (!tray) return;

  const contextMenu = tray.getContextMenu();
  const statusLabels = {
    starting: '⏳',
    running: '✓',
    stopped: '✗',
    error: '❌'
  };

  const label = statusLabels[status] || '?';
  const menuItem = contextMenu.getMenuItemById(`${service}-status`);
  if (menuItem) {
    menuItem.label = `${service}: ${label} ${status}`;
  }
  tray.setContextMenu(contextMenu);
}

/**
 * Update splash screen status
 */
function updateSplashStatus(message, progress) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', { message, progress });
  }
}

/**
 * Initialize and start all services
 */
async function initializeServices() {
  try {
    log.info('Initializing services...');

    // Initialize resource manager
    updateSplashStatus('Checking resources...', 0);
    resourceManager = new ResourceManager(paths.resources, paths.userData);

    // Check and download required resources
    const resourcesReady = await resourceManager.ensureResourcesAvailable((progress) => {
      updateSplashStatus(`Downloading resources... ${Math.round(progress)}%`, progress * 0.2);
    });

    if (!resourcesReady) {
      throw new Error('Failed to download required resources');
    }

    // Get resource paths
    const resourcePaths = resourceManager.getResourcePaths();

    // Initialize services
    updateSplashStatus('Starting PostgreSQL...', 20);
    updateTrayServiceStatus('postgresql', 'starting');
    services.postgresql = new PostgreSQLService(
      resourcePaths.postgresql,
      path.join(paths.userData, 'data', 'postgresql'),
      paths.logs,
      store.get('services.postgresql.port')
    );
    await services.postgresql.start();
    updateTrayServiceStatus('postgresql', 'running');
    log.info('PostgreSQL started');

    updateSplashStatus('Starting Redis...', 40);
    updateTrayServiceStatus('redis', 'starting');
    services.redis = new RedisService(
      resourcePaths.redis,
      path.join(paths.userData, 'data', 'redis'),
      paths.logs,
      store.get('services.redis.port')
    );
    await services.redis.start();
    updateTrayServiceStatus('redis', 'running');
    log.info('Redis started');

    // Prepare environment for Flask
    const env = {
      DATABASE_URL: `postgresql://mnemos:mnemos@localhost:${store.get('services.postgresql.port')}/mnemos_db`,
      REDIS_URL: `redis://localhost:${store.get('services.redis.port')}/0`,
      FLASK_ENV: 'production',
      PYTHONUNBUFFERED: '1',
      EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'local',
      EMBEDDING_DEVICE: process.env.EMBEDDING_DEVICE || 'cpu',
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
      EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION || '384',
      SECRET_KEY: process.env.SECRET_KEY || 'mnemos-electron-secret-key',
      UPLOAD_FOLDER: path.join(paths.userData, 'uploads'),
      WHISPER_MODEL: process.env.WHISPER_MODEL || 'base',
      WHISPER_DEVICE: process.env.WHISPER_DEVICE || 'cpu',
      MODELS_FOLDER: paths.models,
      LLAMACPP_MODEL_PATH: path.join(paths.models, 'model.gguf')
    };

    updateSplashStatus('Starting Flask backend...', 60);
    updateTrayServiceStatus('flask', 'starting');
    services.flask = new FlaskService(
      resourcePaths.python,
      paths.app,
      paths.logs,
      store.get('services.flask.port'),
      env
    );
    await services.flask.start();
    updateTrayServiceStatus('flask', 'running');
    log.info('Flask started');

    updateSplashStatus('Starting Celery worker...', 80);
    updateTrayServiceStatus('celery', 'starting');
    services.celery = new CeleryService(
      resourcePaths.python,
      paths.app,
      paths.logs,
      env
    );
    await services.celery.start();
    updateTrayServiceStatus('celery', 'running');
    log.info('Celery started');

    updateSplashStatus('Loading application...', 90);

    // Wait for Flask to be ready
    await waitForFlask(store.get('services.flask.port'));

    updateSplashStatus('Ready!', 100);

    log.info('All services started successfully');
    return true;

  } catch (error) {
    log.error('Failed to initialize services:', error);
    updateSplashStatus(`Error: ${error.message}`, 0);

    // Update tray to show error
    Object.keys(services).forEach(service => {
      if (!services[service] || !services[service].isRunning) {
        updateTrayServiceStatus(service, 'error');
      }
    });

    dialog.showErrorBox(
      'Service Initialization Failed',
      `Failed to start services:\n\n${error.message}\n\nPlease check the logs for more details.`
    );

    return false;
  }
}

/**
 * Wait for Flask to be ready
 */
async function waitForFlask(port, maxRetries = 30, retryDelay = 1000) {
  const fetch = require('node-fetch');

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        timeout: 2000
      });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Keep waiting
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  throw new Error('Flask failed to start within timeout');
}

/**
 * Shutdown all services
 */
async function shutdownServices() {
  log.info('Shutting down services...');

  const shutdownOrder = ['celery', 'flask', 'redis', 'postgresql'];

  for (const serviceName of shutdownOrder) {
    const service = services[serviceName];
    if (service && service.isRunning) {
      try {
        log.info(`Stopping ${serviceName}...`);
        updateTrayServiceStatus(serviceName, 'stopped');
        await service.stop();
        log.info(`${serviceName} stopped`);
      } catch (error) {
        log.error(`Error stopping ${serviceName}:`, error);
      }
    }
  }

  log.info('All services stopped');
}

/**
 * App ready handler
 */
app.whenReady().then(async () => {
  log.info('Electron app ready');

  // Create windows
  createSplashWindow();
  createMainWindow();
  createTray();

  // Initialize services
  const success = await initializeServices();

  if (success) {
    // Close splash and show main window
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      if (mainWindow) {
        // Load the Flask app
        mainWindow.loadURL(`http://localhost:${store.get('services.flask.port')}`);
        mainWindow.show();
      }
    }, 1000);
  } else {
    // Keep splash visible with error
    if (mainWindow) {
      mainWindow.close();
    }
  }
});

/**
 * Prevent app from quitting when all windows are closed (tray app)
 */
app.on('window-all-closed', (event) => {
  event.preventDefault();
});

/**
 * Handle app activation (macOS)
 */
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

/**
 * Handle app quit
 */
app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    log.info('Application quitting...');

    // Hide windows
    if (mainWindow) mainWindow.hide();
    if (splashWindow) splashWindow.hide();

    // Shutdown services
    await shutdownServices();

    // Quit for real
    app.exit(0);
  }
});

/**
 * IPC Handlers
 */

// Get service status
ipcMain.handle('get-service-status', async () => {
  const status = {};
  for (const [name, service] of Object.entries(services)) {
    status[name] = service ? service.getStatus() : { running: false };
  }
  return status;
});

// Restart service
ipcMain.handle('restart-service', async (event, serviceName) => {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  log.info(`Restarting ${serviceName}...`);
  updateTrayServiceStatus(serviceName, 'starting');

  try {
    await service.stop();
    await service.start();
    updateTrayServiceStatus(serviceName, 'running');
    return { success: true };
  } catch (error) {
    log.error(`Failed to restart ${serviceName}:`, error);
    updateTrayServiceStatus(serviceName, 'error');
    throw error;
  }
});

// Get logs
ipcMain.handle('get-logs', async (event, serviceName) => {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }
  return service.getLogs();
});

// Open external link
ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
});

// Show item in folder
ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
  shell.showItemInFolder(fullPath);
});

// Get application paths
ipcMain.handle('get-paths', async () => {
  return {
    userData: paths.userData,
    logs: paths.logs,
    models: paths.models,
    uploads: path.join(paths.userData, 'uploads')
  };
});

// Open models folder
ipcMain.handle('open-models-folder', async () => {
  shell.openPath(paths.models);
  return { success: true };
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox('Unexpected Error', error.message);
});

process.on('unhandledRejection', (error) => {
  log.error('Unhandled rejection:', error);
});
