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
