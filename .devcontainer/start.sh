#!/usr/bin/env bash
# Start the app (API + built SPA) on port 8000 in the background.
cd "$(dirname "$0")/.."
mkdir -p /tmp/spmb
nohup php artisan serve --host=0.0.0.0 --port=8000 > /tmp/spmb/app.log 2>&1 &
