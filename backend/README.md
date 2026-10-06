# SPMB Terpadu — Backend (Laravel 13 + MySQL)

JSON API for the SPMB Terpadu 2026/2027 admission system. See the repository
root `README.md` for setup and `docs/INFRASTRUCTURE.md` for the migration notes.

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate
php artisan serve
php artisan test          # PHPUnit (SQLite in-memory); set DB_CONNECTION=mysql for MySQL
vendor/bin/pint --test    # code style
```

Layout: `app/Services` (business rules) → `app/Http/Controllers/Api` (thin controllers)
→ `app/Http/Resources` (response contracts); routes in `routes/api.php` (`/api/v1`),
infrastructure probes in `routes/web.php` (`/health`, `/ready`).
