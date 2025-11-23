const CACHE_NAME = 'ecocampus-v2-static';
const DYNAMIC_CACHE = 'ecocampus-v2-dynamic';

// Assets to pre-cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/style.css',
    '/app.js',
    '/utils.js',
    '/state.js',
    '/supabase-client.js',
    '/login.js',
    '/dashboard.js',
    '/store.js',
    '/events.js',
    '/social.js',
    '/challenges.js',
    '/chatbot.js',
    '/realtime.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js'
];

// Install Event: Cache App Shell
self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 SW: Caching Shell Assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Network-First for API, Cache-First for Assets
self.addEventListener('fetch', (evt) => {
    const url = new URL(evt.request.url);

    // 1. Supabase API Calls -> Network First (fallback to nothing, let app handle cache)
    if (url.hostname.includes('supabase.co')) {
        return; // Let the application logic handle API caching via localForage
    }

    // 2. Images (Cloudinary/Placehold) -> Stale-While-Revalidate
    if (url.hostname.includes('cloudinary') || url.hostname.includes('placehold.co')) {
        evt.respondWith(
            caches.open(DYNAMIC_CACHE).then(cache => {
                return cache.match(evt.request).then(cachedResponse => {
                    const fetchPromise = fetch(evt.request).then(networkResponse => {
                        cache.put(evt.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. Static Assets (HTML, JS, CSS) -> Cache First
    evt.respondWith(
        caches.match(evt.request).then((cacheRes) => {
            return cacheRes || fetch(evt.request).then((fetchRes) => {
                return caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(evt.request, fetchRes.clone());
                    return fetchRes;
                });
            });
        }).catch(() => {
            // Fallback for HTML if offline
            if (evt.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
            }
        })
    );
});
