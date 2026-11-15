# cPanel PHP + MySQL deployment

This folder is prepared for a cPanel deployment that replaces the Node/Postgres backend.

## Upload layout

For your case, keep the app inside a subfolder such as:

- `public_html/booking-app`
- `public_html/booking-app/api`

Upload the built frontend bundle from `frontend/dist` into:

- `public_html/booking-app`

Upload the contents of `cpanel-php/api` into:

- `public_html/booking-app/api`

This keeps the app working under a subfolder like `/booking-app` instead of assuming the site root.

## Recommended .htaccess in the app folder

If your app sits under `/booking-app`, place this in `public_html/booking-app/.htaccess`:

```apache
RewriteEngine On

# Serve frontend for normal SPA routes
RewriteCond %{REQUEST_URI} !^/booking-app/api/ [NC]
RewriteCond %{REQUEST_URI} !^/booking-app/api$ [NC]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

The API folder already contains its own `.htaccess` file and will handle `/booking-app/api/*` requests.

## Database setup

Create a MySQL database and user in cPanel, then import the SQL file:

- `cpanel-php/db/schema.sql`

Then update the credentials in:

- `cpanel-php/api/config.php`

## Important notes

- Push notifications are intentionally paused in the frontend for this static deployment.
- The app will keep working as a PWA, with local browser storage for offline use.
- Backend features such as real-time notifications can be restored later with a dedicated backend service.

## Updating an existing deployment

1. Run `npm run deploy-static` from the repository root. It creates `deploy_static.zip` with `/booking-app/` asset paths by default.
2. Upload and extract the ZIP contents into `public_html/booking-app`, replacing `index.html` and the `assets` directory. Keep `.htaccess` and `api/` in place.
3. Replace `api/index.php` and `api/config.php` with the updated API code. When updating `config.php`, preserve the live `APP_SECRET` and database credentials; do not overwrite them with local placeholder values.
4. Upload the updated `cpanel-php/db/schema.sql` to `public_html/booking-app/db/schema.sql`. The API reads this file to create or upgrade tables without deleting existing rows.
5. Refresh the app. The updated service worker clears the previous static cache when it activates.

Existing expense records have no homestay assignment and appear as unassigned until they are recorded with a homestay. They are not included in an individual homestay's totals.

## Resetting the cPanel PIN

If the current PIN is unavailable, run the CLI-only reset script from cPanel Terminal after uploading it to `public_html/booking-app/api/scripts/reset-pin.php`:

```sh
php public_html/booking-app/api/scripts/reset-pin.php 123456
```

The script updates only the `pin_hash` and `auth_token` entries in `app_config`; it does not change bookings, properties, expenses, or other database rows. It refuses to run from a web request. Preserve the existing `api/config.php` database credentials and `APP_SECRET`.
