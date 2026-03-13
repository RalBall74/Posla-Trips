const CACHE_NAME = 'posla-trips-v1';
const BASE_PATH = '/Posla-Trips';

// all stuff to cache on install
const ASSETS_TO_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/home.html`,
  `${BASE_PATH}/css/style.css`,
  `${BASE_PATH}/css/home.css`,
  `${BASE_PATH}/js/app.js`,
  `${BASE_PATH}/js/home.js`,
  `${BASE_PATH}/js/firebase-config.js`,
  `${BASE_PATH}/js/trips.json`,
  `${BASE_PATH}/assets/logo.jpg`,
  `${BASE_PATH}/manifest.json`,
];

// install - cache everything
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('posla sw: caching all assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((err) => {
      console.log('posla sw: cache failed for some assets, continuing...', err);
    })
  );
  self.skipWaiting();
});

// activate - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('posla sw: deleting old cache', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// fetch - network first, then cache fallback
self.addEventListener('fetch', (event) => {
  // skip non-GET and firebase/external requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // external stuff like firebase, fonts, unpkg - just go online
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes('firebase') ||
    url.pathname.includes('fonts.gstatic') ||
    url.pathname.includes('fonts.googleapis') ||
    url.pathname.includes('unpkg.com')
  ) {
    return;
  }

  event.respondWith(
    // try network first
    fetch(event.request)
      .then((response) => {
        // cache the fresh response
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // no internet? use cache
        return caches.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }
          // fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(`${BASE_PATH}/index.html`);
          }
        });
      })
  );
});

// listen for skip waiting message from ui
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
