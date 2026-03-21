# MNEMOS Electron Application

Production-ready Electron wrapper for MNEMOS that packages the entire application into a standalone Windows executable.

## 🎯 What This Does

This Electron wrapper transforms MNEMOS from a Docker-based application into a **single-click installable desktop app** with:

- ✅ **No Docker/Podman required** - All services run natively
- ✅ **No WSL2 required** - Pure Windows application
- ✅ **Embedded PostgreSQL** with pgvector extension
- ✅ **Embedded Redis** for caching and task queue
- ✅ **Embedded Python** runtime with all dependencies
- ✅ **Self-contained** - Works completely offline
- ✅ **Professional installer** - NSIS-based Windows installer
- ✅ **System tray** integration
- ✅ **Auto-updates** ready (GitHub releases)

## 📦 Architecture

```
MNEMOS.exe
├── Electron (Chromium + Node.js)
├── PostgreSQL Portable
├── Redis for Windows
├── Python 3.11 Embedded
├── Flask Backend
├── Celery Worker
└── Angular Frontend
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** - https://nodejs.org/
2. **Angular CLI** - Already in frontend_spa
3. **Python 3.11** - For local development (not required for build)

### Build Instructions

#### Step 1: Build Angular Frontend

```bash
cd ../frontend_spa
npm install
npm run build
```

#### Step 2: Install Electron Dependencies

```bash
cd ../electron
npm install
```

#### Step 3: Build the Installer

```bash
# Option 1: Use the build script (recommended)
node build.js

# Option 2: Manual build
npm run build

# Option 3: Build portable version
npm run build:portable
```

The installer will be created in `electron/dist/`:
- `MNEMOS-Setup-1.0.0.exe` - Full installer (~250-300 MB)
- `MNEMOS-Portable-1.0.0.exe` - Portable version (optional)

## 🔧 Development Mode

To run in development without building:

```bash
npm run dev
```

This will:
- Use your local Python installation
- Connect to local PostgreSQL and Redis (if available)
- Enable hot-reload and debug logging

## 📋 Project Structure

```
electron/
├── main.js              # Electron main process
├── preload.js           # IPC security bridge
├── package.json         # Electron configuration
├── build.js             # Build script
│
├── services/            # Service managers
│   ├── base-service.js
│   ├── postgresql.js    # PostgreSQL manager
│   ├── redis.js         # Redis manager
│   ├── flask.js         # Flask backend manager
│   ├── celery.js        # Celery worker manager
│   └── resource-manager.js  # Binary downloader
│
├── ui/                  # UI components
│   └── splash.html      # Loading screen
│
├── build/               # Build resources
│   ├── icon.ico         # App icon
│   ├── tray-icon.png    # System tray icon
│   └── installer.nsh    # NSIS installer script
│
└── resources/           # Runtime resources (created at runtime)
    └── downloads/       # Downloaded binaries (PostgreSQL, Redis, Python)
```

## 🔄 How It Works

### 1. First Launch

When a user runs the installer:

1. **Installation** - Copies files to `C:\Program Files\MNEMOS`
2. **First run** - Electron starts
3. **Resource check** - Checks if PostgreSQL, Redis, Python exist
4. **Auto-download** - Downloads missing binaries automatically (~150 MB)
5. **Extraction** - Extracts to `%APPDATA%\MNEMOS\binaries`
6. **Service startup**:
   - PostgreSQL initializes database (creates pgvector extension)
   - Redis starts with persistence
   - Python installs requirements.txt
   - Flask runs database migrations
   - Celery worker starts
7. **Ready** - Opens MNEMOS in Electron window

### 2. Subsequent Launches

- All services start in ~5-8 seconds
- No downloads needed
- Direct to application

### 3. Updates

Auto-updater checks for new versions on GitHub releases and prompts user to install.

## 🎛️ Service Management

### Ports

- **Frontend**: Electron window (no port exposure)
- **Flask Backend**: 5000
- **PostgreSQL**: 5432
- **Redis**: 6379

All services bind to `localhost` only for security.

### System Tray

Right-click the system tray icon to:
- Show/Hide main window
- View service status
- Open logs folder
- Open data folder
- Quit application

### Logs

Logs are saved to:
```
%APPDATA%\MNEMOS\logs\
├── postgresql.log
├── redis.log
├── flask.log
├── celery.log
└── main.log (Electron)
```

## 💾 Data Storage

User data is stored in:
```
%APPDATA%\MNEMOS\
├── data\
│   ├── postgresql\   # Database files
│   └── redis\        # Redis persistence
├── uploads\          # User uploads
└── binaries\         # Downloaded binaries
    ├── postgresql\
    ├── redis\
    └── python\
```

## 🔐 Security

- All services run with user privileges (no admin required after install)
- Services bind to localhost only
- Context isolation enabled (Electron security)
- CSP headers enforced
- No remote code execution

## 🐛 Troubleshooting

### Build Fails

**Problem**: `Angular dist not found`
```bash
cd ../frontend_spa
npm run build
```

**Problem**: `electron-builder fails`
```bash
cd electron
rm -rf node_modules package-lock.json
npm install
```

### Runtime Issues

**Problem**: Services won't start

1. Check logs in `%APPDATA%\MNEMOS\logs`
2. Check if ports are in use:
   ```cmd
   netstat -ano | findstr "5000 5432 6379"
   ```
3. Try reinstalling

**Problem**: PostgreSQL fails to initialize
- Check if you have Visual C++ Redistributable installed
- Install from: https://aka.ms/vs/17/release/vc_redist.x64.exe

**Problem**: Python dependencies fail
- Check internet connection (needed for first run)
- Check `flask.log` for specific package errors

## 📦 Distribution

### Building for Release

```bash
# 1. Update version in package.json
# 2. Build Angular production
cd ../frontend_spa
npm run build

# 3. Build Electron
cd ../electron
node build.js

# 4. Test the installer
cd dist
MNEMOS-Setup-1.0.0.exe
```

### File Sizes

Approximate sizes:
- Installer: ~250-300 MB (includes everything)
- Installed: ~800 MB - 1 GB (after Python packages)
- Downloads (first run): ~150 MB (PostgreSQL, Redis, Python)

### Publishing

To enable auto-updates:

1. Update `package.json`:
   ```json
   "build": {
     "publish": {
       "provider": "github",
       "owner": "your-username",
       "repo": "mnemos"
     }
   }
   ```

2. Create GitHub release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. Upload installer to GitHub release

4. Auto-updater will check for new versions

## 🔧 Configuration

### Environment Variables

Users can create `.env` file in `%APPDATA%\MNEMOS\.env`:

```env
# LLM Provider
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Embeddings
EMBEDDING_MODEL=bge-m3
EMBEDDING_DEVICE=cuda

# Whisper
WHISPER_MODEL=base
WHISPER_DEVICE=cuda
```

### GPU Support

The application supports CUDA GPUs for:
- Embeddings (sentence-transformers)
- Whisper transcription
- LLM inference (if using local models)

Requirements:
- NVIDIA GPU with CUDA support
- CUDA drivers installed

## 📝 License

AGPL-3.0 - See LICENSE file

## 🤝 Contributing

This Electron wrapper is part of the MNEMOS project. For contributions:

1. Make changes in `electron/` directory
2. Test with `npm run dev`
3. Build and test installer
4. Submit PR

## 🆘 Support

For issues:
- Check logs in `%APPDATA%\MNEMOS\logs`
- Open GitHub issue with logs attached
- Include OS version and hardware specs

## 🎉 Credits

Built with:
- Electron
- PostgreSQL with pgvector
- Redis
- Python Flask
- Angular

---

**Happy Building! 🚀**
