(function() {
    // get lang
    const currentLang = localStorage.getItem('polsa-lang') || 'en';
    const isRtl = currentLang === 'ar';
    
    // messags
    const msg = {
        en: 'You are offline. Some trips may not load and features may be limited.',
        ar: 'أنت غير متصل بالإنترنت. قد لا تظهر بعض الرحلات أو تعمل بعض الميزات.'
    };

    // make the banner element
    const banner = document.createElement('div');
    banner.id = 'offline-notification';
    banner.className = 'offline-notification';
    
    // flip dir if needed
    const dirAttr = isRtl ? 'dir="rtl"' : 'dir="ltr"';
    
    banner.innerHTML = `
        <div class="offline-content" ${dirAttr}>
            <i data-lucide="wifi-off"></i>
            <span>${msg[currentLang]}</span>
        </div>
    `;

    // inject styles if missin
    if (!document.querySelector('link[href*="offline.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/offline.css';
        document.head.appendChild(link);
    }

    document.body.appendChild(banner);

    // update net status
    function updateOnlineStatus() {
        const notification = document.getElementById('offline-notification');
        if (!navigator.onLine) {
            notification.classList.add('show');
            // if we home, maybe show Empty msg
            if (typeof allTrips !== 'undefined' && allTrips.length === 0) {
                console.log('offline n no trips cached.');
            }
        } else {
            notification.classList.remove('show');
        }
    }

    // listen 4 changes
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // check now
    setTimeout(() => {
        updateOnlineStatus();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 1000);
})();
