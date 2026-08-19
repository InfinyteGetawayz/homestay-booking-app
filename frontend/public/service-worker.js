const CACHE_NAME = 'infinite-getaways-v1';
// Service worker runs in worker context — avoid import.meta and window APIs here.
const base = self.registration.scope || '/';
const STATIC_ASSETS = [
  new URL('./index.html', base).pathname,
  new URL('./manifest.webmanifest', base).pathname,
  new URL('./icon-192.png', base).pathname,
  new URL('./icon-512.png', base).pathname
];

// Install: Cache core static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Stale-While-Revalidate for app assets, bypass API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Do not intercept API requests - let the frontend handle offline fallback for data
  if (url.pathname.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch new version in background to update cache
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors offline */});
        
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// Push: Handle push notifications from backend
self.addEventListener('push', event => {
  let data = { title: 'Infinite Getaways', body: 'New notification received.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Infinite Getaways', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: new URL('./icon-192.png', base).pathname,
    badge: new URL('./icon-192.png', base).pathname,
    data: {
      bookingId: data.bookingId
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Push Click: Open or focus application window
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const targetUrl = new URL(base).pathname || '/';
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
