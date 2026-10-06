#!/usr/bin/env bash
# One-time demo setup: SQLite + demo data, so no MySQL is needed to try the app.
set -euo pipefail
cd "$(dirname "$0")/../backend"
composer install --no-interaction --prefer-dist
cp -n .env.example .env
sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/; s/^CACHE_STORE=.*/CACHE_STORE=file/; s/^SESSION_DRIVER=.*/SESSION_DRIVER=file/; s/^QUEUE_CONNECTION=.*/QUEUE_CONNECTION=sync/' .env
php artisan key:generate --force
touch database/database.sqlite
php artisan migrate --force --seed
cd ../frontend && npm install
