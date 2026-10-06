#!/usr/bin/env bash
# Start API (8000) and frontend (5173) in the background; open port 5173.
cd "$(dirname "$0")/.."
mkdir -p /tmp/spmb
(cd backend && nohup php artisan serve --host=0.0.0.0 --port=8000 > /tmp/spmb/api.log 2>&1 &)
(cd frontend && nohup npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/spmb/web.log 2>&1 &)
