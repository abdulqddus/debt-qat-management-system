// اسم الكاش
const CACHE_NAME = 'debt-wallet-v3';
const OFFLINE_URL = '/debt-qat-management-system/offline.html';

// الملفات التي سيتم تخزينها
const urlsToCache = [
  '/debt-qat-management-system/',
  '/debt-qat-management-system/index.html',
  '/debt-qat-management-system/style2.css',
  '/debt-qat-management-system/script1.js',
  '/debt-qat-management-system/manifest.json',
  'https://i.ibb.co/PZDXdwtt/wallet-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: يتم التثبيت');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📁 Service Worker: يتم تخزين الملفات');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: تم التثبيت بنجاح');
        return self.skipWaiting();
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: تم التفعيل');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: حذف الكاش القديم', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: جاهز للعمل');
      return self.clients.claim();
    })
  );
});

// جلب الملفات
self.addEventListener('fetch', event => {
  // تجاهل طلبات POST وغير GET
  if (event.request.method !== 'GET') return;
  
  // تجاهل طلبات Firebase و Google APIs
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد الملف في الكاش
        if (response) {
          console.log('💾 Service Worker: تقديم من الكاش', event.request.url);
          return response;
        }
        
        // إذا لم يجده، يحمله من الشبكة
        console.log('🌐 Service Worker: تحميل من الشبكة', event.request.url);
        return fetch(event.request)
          .then(response => {
            // التحقق مما إذا كانت الاستجابة صالحة للتخزين
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // نسخ الاستجابة للتخزين
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 Service Worker: تم تخزين', event.request.url);
              });
            
            return response;
          })
          .catch(error => {
            console.log('❌ Service Worker: خطأ في الجلب', error);
            
            // إذا فشل الجلب وكان الطلب للصفحة الرئيسية
            if (event.request.mode === 'navigate') {
              return caches.match('/debt-qat-management-system/');
            }
            
            return new Response('عذراً، لا يمكن تحميل الصفحة.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/html; charset=utf-8'
              })
            });
          });
      })
  );
});

// استلام رسائل من الصفحة
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
