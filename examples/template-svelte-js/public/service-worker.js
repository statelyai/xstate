const CACHE_NAME = `cache_${1626762923990}`;

const shell = ['/', '/manifest.json', '/global.css', '/build/bundle.js', '/build/bundle.css'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(shell))
            .then(() => {
                self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(async (keys) => {
            // delete old caches
            for (const key of keys) {
                if (key !== CACHE_NAME) await caches.delete(key);
            }

            self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // try the network first, falling back to cache if offline
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            try {
                const response = await fetch(event.request);
                cache.put(event.request, response.clone());
                return response;
            } catch (err) {
                const response = await cache.match(event.request);
                if (response) return response;

                throw err;
            }
        })
    );
});
