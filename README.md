

<div align="center" style="position: relative; max-width: 700px; margin: 0 auto; border-radius: 16px; overflow: hidden;">
  <img src="frontend_spa/public/mnemosyne-awa-optimized.gif" alt="MNEMOS background" style="width: 100%; display: block;">
  <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
    <img src="frontend_spa/public/favicon.svg" alt="MNEMOS icon" style="width: 64px; height: 64px; margin-bottom: 8px;">
    <h1 style="font-family: 'Georgia', 'Times New Roman', serif; font-size: clamp(2rem, 6vw, 4rem); font-weight: 700; color: white; text-shadow: 0 2px 12px rgba(0,0,0,0.6); margin: 0; letter-spacing: 0.05em;">MNEMOS</h1>
    <p style="font-family: sans-serif; font-size: clamp(0.9rem, 2vw, 1.2rem); color: rgba(255,255,255,0.85); margin: 4px 0 0 0; text-shadow: 0 1px 6px rgba(0,0,0,0.5);">Context Daemon</p>
  </div>
</div>

---

## ¿Qué es MNEMOS?

MNEMOS es un sistema **GraphRAG** + **Wiki** que convierte documentos (PDF, audio, video, YouTube, imágenes) en un **hipergrafo de conocimiento** interconectado.

Piensa en él como una **wiki inteligente y automática**: subes documentos, MNEMOS extrae conceptos, los relaciona y construye un grafo navegable. Puedes chatear con tus documentos, explorar el grafo y descubrir conexiones que no sabías que existían.

Funciona **en tu propio equipo** con modelos locales (llama.cpp) o usando APIs externas (OpenAI, Anthropic, Groq) si prefieres más potencia sin consumir recursos locales.

---

## Características principales

| Qué hace | Cómo lo hace |
|---|---|
| **GraphRAG + Wiki** | Extrae conceptos y relaciones → wiki navegable con artículos, búsqueda semántica y grafo de conocimiento |
| **Documentos multimedia** | PDF, audio, video, YouTube, imágenes — todo se procesa y conecta en el mismo grafo |
| **Chat inteligente** | Conversaciones con contexto de tus documentos, respuestas con citas a fuentes |
| **Búsqueda híbrida** | Combina búsqueda vectorial (sentido semántico) + texto completo (palabras exactas) |
| **Procesamiento en segundo plano** | Sube documentos y sigue trabajando — el sistema los procesa asíncronamente |
| **Memoria persistente** | El sistema recuerda hechos sobre ti entre conversaciones |
| **Local o cloud** | Usa modelos locales (llama.cpp, LM Studio, Ollama) o APIs externas (OpenAI, Anthropic, Groq) |
| **Interfaz moderna** | Angular SPA con diseño responsivo, gráficos de conocimiento en vivo |

---

## Tecnología usada (y por qué)

### Backend
| Tecnología | Beneficio |
|---|---|
| **Flask** (Python) | Ligero, flexible, fácil de extender |
| **Celery + Redis** | Tareas en segundo plano sin bloquear al usuario |
| **SQLAlchemy** | ORM maduro, migraciones con Alembic |
| **llama.cpp** | Ejecuta modelos locales GGUF con aceleración GPU (NVIDIA CUDA) |
| **OpenAI / Anthropic / Groq** | Conecta APIs cloud cuando no quieres usar recursos locales |

### Frontend
| Tecnología | Beneficio |
|---|---|
| **Angular 21** | Framework moderno, componentes reutilizables, tipado fuerte |
| **TailwindCSS** | Estilos consistentes y rápidos sin CSS custom |
| **RxJS** | Datos reactivos en tiempo real |
| **Cytoscape.js** | Visualización interactiva del grafo de conocimiento |

### Base de datos
| Tecnología | Beneficio |
|---|---|
| **PostgreSQL 16 + pgvector** | Búsqueda vectorial de alto rendimiento + búsqueda de texto completo |
| **Índices HNSW** | Búsquedas vectoriales ultrarrápidas incluso con millones de fragmentos |

### ¿Por qué esta combinación?
- **Todo corre en Docker** → no instalan nada raro en tu sistema, solo Docker Desktop
- **GPU autodetected** → si tienes NVIDIA CUDA, se usa; si no, corre en CPU
- **Modelos locales con llama.cpp** → sin depender de internet, sin costos de API
- **Pero también acepta APIs** → si quieres usar GPT-4 o Claude, solo configura las keys

---

## Instalación

### Requisitos
- **Windows 10/11**
- **Docker Desktop** instalado y funcionando
- **8 GB RAM** mínimo (16 GB recomendado)
- **GPU NVIDIA** (opcional, para aceleración)

### Pasos

1. **Clona el repositorio**
   ```
   git clone <url-del-repo>
   cd mnemos/dev
   ```

2. **Configura las variables de entorno**
   - Copia `.env.example` a `.env`
   - Edita `.env` según tus preferencias (LLM provider, API keys, etc.)

3. **Ejecuta `start.bat`**
   - Dale doble clic a `start.bat`
   - El script construye las imágenes Docker (si hay cambios) y levanta todos los servicios
   - Se abre automáticamente http://localhost:5200

4. **¡Listo!** La interfaz web está funcionando.

### Notas importantes
- **Primera ejecución**: tarda unos minutos en descargar dependencias y construir imágenes.
- **Modelos GGUF**: coloca tus modelos `.gguf` en la carpeta `models/`. Si hay al menos uno, `start.bat` activa el servidor llama.cpp automáticamente.
- **Sin GPU**: si no tienes NVIDIA CUDA, usa `docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up -d` (o edita `start.bat` para incluir CPU mode).

### Comandos útiles
```bash
# Ver logs
docker-compose logs -f app

# Detener todo
docker-compose down

# Reconstruir desde cero
docker-compose up -d --build
```

---

## Estructura del proyecto

```
dev/
├── app/                  # Backend Flask (API, servicios, modelos)
├── frontend_spa/         # Frontend Angular 21 (SPA moderna)
├── config/               # Configuración centralizada
├── models/               # Modelos GGUF para llama.cpp
├── data/                 # Uploads, cachés, archivos
├── docker-compose.yml    # Orquestación Docker
├── start.bat             # ★ Punto de entrada recomendado
└── .env                  # Variables de entorno
```

---

## Uso básico

1. **Sube documentos**: ve a "Documents" → arrastra PDF, audio, video o pega URL de YouTube
2. **Explora el Wiki**: los conceptos extraídos aparecen en la sección Wiki, con artículos y relaciones
3. **Chatea**: ve a "Chat" → haz preguntas sobre tus documentos
4. **Visualiza el grafo**: explora conexiones entre conceptos en la vista de grafo interactivo

---

## Licencia

**GNU Affero General Public License v3.0 (AGPLv3)** — ver archivo `LICENSE`.

---

<br>
<br>

# MNEMOS — Context Daemon

---

## What is MNEMOS?

MNEMOS is a **GraphRAG** + **Wiki** system that turns documents (PDF, audio, video, YouTube, images) into an interconnected **knowledge hypergraph**.

Think of it as a **smart, auto-building wiki**: upload documents, MNEMOS extracts concepts, links them together, and builds a navigable graph. You can chat with your documents, explore the graph, and discover connections you didn't know existed.

It runs **on your own hardware** with local models (llama.cpp) or connects to external APIs (OpenAI, Anthropic, Groq) when you want more power without using local resources.

---

## Key Features

| What | How |
|---|---|
| **GraphRAG + Wiki** | Extracts concepts & relationships → browsable wiki with articles, semantic search, and knowledge graph |
| **Multimedia documents** | PDF, audio, video, YouTube, images — all processed and linked in the same graph |
| **Smart Chat** | Conversational AI grounded in your documents, with source citations |
| **Hybrid Search** | Vector search (meaning) + full-text search (keywords) combined |
| **Background processing** | Upload documents and keep working — async queue handles the rest |
| **Persistent memory** | Remembers facts about you across conversations |
| **Local or Cloud LLMs** | Use local models (llama.cpp, LM Studio, Ollama) or cloud APIs (OpenAI, Anthropic, Groq) |
| **Modern UI** | Angular SPA with responsive design, live knowledge graph visualization |

---

## Tech Stack & Why

### Backend
| Technology | Why |
|---|---|
| **Flask** (Python) | Lightweight, flexible, easy to extend |
| **Celery + Redis** | Async background tasks — uploads never block the UI |
| **SQLAlchemy** | Mature ORM with Alembic migrations |
| **llama.cpp** | Runs local GGUF models with GPU acceleration (NVIDIA CUDA) |
| **OpenAI / Anthropic / Groq** | Plug in cloud APIs when you don't want to use local resources |

### Frontend
| Technology | Why |
|---|---|
| **Angular 21** | Modern framework, reusable components, strong typing |
| **TailwindCSS** | Fast, consistent styling without custom CSS |
| **RxJS** | Reactive, real-time data flow |
| **Cytoscape.js** | Interactive knowledge graph visualization |

### Database
| Technology | Why |
|---|---|
| **PostgreSQL 16 + pgvector** | High-performance vector search + full-text search in one DB |
| **HNSW indexes** | Blazing fast vector similarity even with millions of chunks |

### Why this stack?
- **Everything runs in Docker** → no weird system installs, just Docker Desktop
- **GPU auto-detected** → NVIDIA CUDA? It uses it. No GPU? Falls back to CPU
- **Local models with llama.cpp** → no internet dependency, no API costs
- **But cloud APIs work too** → want GPT-4 or Claude? Just configure the keys

---

## Installation

### Requirements
- **Windows 10/11**
- **Docker Desktop** installed and running
- **8 GB RAM** minimum (16 GB recommended)
- **NVIDIA GPU** (optional, for acceleration)

### Steps

1. **Clone the repo**
   ```
   git clone <repo-url>
   cd mnemos/dev
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env`
   - Edit `.env` with your preferences (LLM provider, API keys, etc.)

3. **Run `start.bat`**
   - Double-click `start.bat`
   - The script builds Docker images (if needed) and starts all services
   - Opens http://localhost:5200 automatically

4. **Done!** The web UI is ready.

### Important notes
- **First run**: takes a few minutes to download dependencies and build images.
- **GGUF models**: put your `.gguf` models in `models/`. If at least one is present, `start.bat` automatically enables the llama.cpp server.
- **No GPU**: if you don't have NVIDIA CUDA, use `docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up -d` (or modify `start.bat` for CPU mode).

### Useful commands
```bash
# View logs
docker-compose logs -f app

# Stop everything
docker-compose down

# Rebuild from scratch
docker-compose up -d --build
```

---

## Project structure

```
dev/
├── app/                  # Flask backend (API, services, models)
├── frontend_spa/         # Angular 21 frontend (modern SPA)
├── config/               # Centralized settings
├── models/               # GGUF models for llama.cpp
├── data/                 # Uploads, caches, archives
├── docker-compose.yml    # Docker orchestration
├── start.bat             # ★ Recommended entry point
└── .env                  # Environment variables
```

---

## Basic usage

1. **Upload documents**: go to "Documents" → drag & drop PDF, audio, video, or paste a YouTube URL
2. **Explore the Wiki**: extracted concepts appear in the Wiki section with articles and relationships
3. **Chat**: go to "Chat" → ask questions about your documents
4. **Visualize the graph**: explore concept connections in the interactive graph view

---

## License

**GNU Affero General Public License v3.0 (AGPLv3)** — see `LICENSE` file.
