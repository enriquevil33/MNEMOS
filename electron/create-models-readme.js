#!/usr/bin/env node

/**
 * Creates README.txt in the models folder on first run
 * This helps users understand how to add .gguf models
 */

const fs = require('fs');
const path = require('path');

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

CONFIGURATION:
--------------

Models in this folder are automatically available via:
- MODELS_FOLDER environment variable in Flask
- Default model path: MODELS_FOLDER/model.gguf

You can configure which model to use in MNEMOS settings.

For detailed instructions, see:
electron/models-folder-readme.md in the source code

---
MNEMOS - AI-Powered Context & Memory System
`;

module.exports = function createModelsReadme(modelsPath) {
  const readmePath = path.join(modelsPath, 'README.txt');

  // Only create if doesn't exist (don't overwrite user's notes)
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log('Created README.txt in models folder');
  }
};

// If run directly
if (require.main === module) {
  const { app } = require('electron');
  const modelsPath = path.join(app.getPath('userData'), 'models');

  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true });
  }

  module.exports(modelsPath);
}
