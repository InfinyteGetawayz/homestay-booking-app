# cPanel PHP + MySQL deployment

This folder is prepared for a cPanel deployment that replaces the Node/Postgres backend.

## Upload layout

- Upload the contents of `cpanel-php/api` to your cPanel account under a folder such as:
  - `public_html/api`
- Upload the built frontend bundle from `frontend/dist` to the site root, such as:
  - `public_html`

## Recommended .htaccess in public_html

```apache
RewriteEngine On

# Serve frontend for normal routes
RewriteCond %{REQUEST_URI} !^/api/ [NC]
RewriteCond %{REQUEST_URI} !^/api$ [NC]
RewriteRule ^ index.html [L]
```

If you want to keep the API separate, make sure the API folder is mounted at `/api` and uses the included `/api/.htaccess` rewrite file.

## Database setup

Create a MySQL database and user in cPanel, then import the SQL file:

- `cpanel-php/db/schema.sql`

Then update the credentials in:

- `cpanel-php/api/config.php`

## Important notes

- Push notifications are intentionally paused in the frontend for this static deployment.
- The app will keep working as a PWA, with local browser storage for offline use.
- Backend features such as real-time notifications can be restored later with a dedicated backend service.
