#!/bin/bash
set -e

# Note: Database tables are now created automatically by SQLAlchemy's db.create_all()
# No need for migrations - the models define the schema directly

# Update yt-dlp on startup to prevent 403 errors (YouTube frequently updates anti-scraping)
pip install --no-cache-dir --upgrade yt-dlp

# Execute the main command
exec "$@"
