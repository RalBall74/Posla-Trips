import { auth, signOut, onAuthStateChanged, db, collection, onSnapshot } from './firebase-config.js';

let allTrips = [];
let currentCategory = 'All';
let favorites = JSON.parse(localStorage.getItem('posla-favorites')) || [];
let firestoreListenerActive = false;

// get trips from firestore real-time (with json fallback)
function loadTrips() {
    const container = document.getElementById('trips-container');
    if (!container || firestoreListenerActive) return;

    try {
        const tripsRef = collection(db, 'trips');
        firestoreListenerActive = true;

        onSnapshot(tripsRef, (snapshot) => {
            if (snapshot.empty) {
                loadTripsFromJSON();
                return;
            }

            allTrips = [];
            const seen = new Set();

            snapshot.forEach((docSnap) => {
                const docId = docSnap.id;
                if (seen.has(docId)) return;
                seen.add(docId);

                const data = docSnap.data();
                data.id = docId;
                allTrips.push(data);
            });

            allTrips.sort((a, b) => Number(a.id) - Number(b.id));
            filterTrips();
            console.log('posla: trips synced:', allTrips.length);
        }, (err) => {
            console.error('posla: firestore error, using json:', err);
            firestoreListenerActive = false;
            loadTripsFromJSON();
        });
    } catch (err) {
        console.error('posla: firestore init error, using json:', err);
        firestoreListenerActive = false;
        loadTripsFromJSON();
    }
}

// json fallback if firebase fails
async function loadTripsFromJSON() {
    try {
        const response = await fetch('./js/trips.json');
        const data = await response.json();
        allTrips = (data.trips || []).map(t => ({ ...t, id: String(t.id) }));
        renderTrips(allTrips);
    } catch (error) {
        console.error("failed to load trips:", error);
    }
}

function renderTrips(tripsToRender) {
    const container = document.getElementById('trips-container');
    if (!container) return;

    if (tripsToRender.length === 0) {
        container.innerHTML = `<div style="text-align: center; width: 100%; color: #64748b; padding: 40px;" class="no-results">No results found.</div>`;
        return;
    }

    const isRtl = document.body.dir === 'rtl';

    container.innerHTML = tripsToRender.map(trip => {
        const isFav = favorites.includes(String(trip.id));
        const name = isRtl ? (trip.nameAr || trip.name) : trip.name;
        const location = isRtl ? (trip.locationAr || trip.location) : trip.location;
        
        return `
            <div class="city-card" data-id="${trip.id}" data-category="${trip.category}">
                <div class="card-image-wrap">
                    <img src="${trip.image}" alt="${name}">
                    <button class="heart-btn ${isFav ? 'active' : ''}" data-id="${trip.id}">
                        <i data-lucide="heart" fill="${isFav ? 'currentColor' : 'none'}" style="color: ${isFav ? '#ef4444' : '#111827'}"></i>
                    </button>
                </div>
                <div class="city-info">
                    <h4>${name}</h4>
                    <div class="city-location">
                        <i data-lucide="map-pin" width="16" height="16"></i>
                        <span>${location}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
    setupHeartListeners();
}

function filterTrips() {
    const searchQuery = document.getElementById('search-input')?.value.toLowerCase().trim() || "";
    const filtered = allTrips.filter(trip => {
        const matchesCategory = currentCategory === 'All' || trip.category === currentCategory;
        const matchesSearch = trip.name.toLowerCase().includes(searchQuery) || 
                              (trip.nameAr && trip.nameAr.toLowerCase().includes(searchQuery)) || 
                              trip.location.toLowerCase().includes(searchQuery) ||
                              (trip.locationAr && trip.locationAr.toLowerCase().includes(searchQuery)) ||
                              (trip.category && trip.category.toLowerCase().includes(searchQuery));
        return matchesCategory && matchesSearch;
    });
    renderTrips(filtered);
}

function setupHeartListeners() {
    const heartBtns = document.querySelectorAll('.heart-btn');
    heartBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const tripId = String(btn.dataset.id);
            const icon = btn.querySelector('[data-lucide], svg');
            
            if (favorites.includes(tripId)) {
                favorites = favorites.filter(id => id !== tripId);
                if (icon) {
                    icon.setAttribute('fill', 'none');
                    icon.style.color = '#111827';
                }
                btn.classList.remove('active');
            } else {
                favorites.push(tripId);
                if (icon) {
                    icon.setAttribute('fill', 'currentColor');
                    icon.style.color = '#ef4444';
                }
                btn.classList.add('active');
                btn.classList.add('pop');
                setTimeout(() => btn.classList.remove('pop'), 450);
            }
            localStorage.setItem('posla-favorites', JSON.stringify(favorites));
        };
    });
}

// popups n details view
window.openTripDetails = function(id) {
    const trip = allTrips.find(t => String(t.id) === String(id));
    if (!trip) return;

    const isRtl = document.body.dir === 'rtl';

    document.getElementById('detail-main-image').src = trip.image;
    document.getElementById('detail-trip-name').textContent = isRtl ? (trip.nameAr || trip.name) : trip.name;
    document.getElementById('detail-trip-location').textContent = isRtl ? (trip.locationAr || trip.location) : trip.location;
    document.getElementById('detail-trip-price').textContent = `EGP ${trip.price}`;
    document.getElementById('detail-trip-address').textContent = isRtl ? (trip.locationAr || trip.address) : trip.address;
    document.getElementById('detail-trip-open-time').textContent = trip.openTime;
    document.getElementById('detail-trip-desc').textContent = trip.description || "";

    const mapIframe = document.getElementById('detail-map-iframe');
    if (mapIframe) {
        mapIframe.src = trip.mapUrl || `https://maps.google.com/maps?q=${encodeURIComponent(trip.address)}&output=embed`;
    }

    const galleryContainer = document.getElementById('detail-gallery-container');
    if (trip.gallery && trip.gallery.length > 0) {
        galleryContainer.innerHTML = trip.gallery.map((img, idx) => {
            if (idx > 3) return ''; // limit display but keep logic if needed
            const isLast = idx === 3 && trip.gallery.length > 4;
            return `
                <div class="gallery-thumb ${idx === 0 ? 'active' : ''} ${isLast ? 'gallery-more' : ''}" onclick="window.updateMainGalleryImage('${img}', this)">
                    <img src="${img}" alt="Gallery">
                    ${isLast ? `<div class="gallery-count">+${trip.gallery.length - 4}</div>` : ''}
                </div>
            `;
        }).join('');
        galleryContainer.style.display = 'flex';
    } else {
        galleryContainer.style.display = 'none';
    }

    const detailHeart = document.getElementById('detail-heart-btn');
    const isFav = favorites.includes(String(trip.id));
    const heartIcon = detailHeart.querySelector('[data-lucide], svg');
    
    if (heartIcon) {
        heartIcon.setAttribute('fill', isFav ? 'currentColor' : 'none');
        heartIcon.style.color = isFav ? '#ef4444' : 'inherit';
    }
    
    detailHeart.onclick = () => {
        const tid = String(trip.id);
        const currentIcon = detailHeart.querySelector('[data-lucide], svg');
        if (favorites.includes(tid)) {
            favorites = favorites.filter(fid => fid !== tid);
            if (currentIcon) {
                currentIcon.setAttribute('fill', 'none');
                currentIcon.style.color = 'inherit';
            }
        } else {
            favorites.push(tid);
            if (currentIcon) {
                currentIcon.setAttribute('fill', 'currentColor');
                currentIcon.style.color = '#ef4444';
            }
            detailHeart.classList.add('pop');
            setTimeout(() => detailHeart.classList.remove('pop'), 450);
        }
        localStorage.setItem('posla-favorites', JSON.stringify(favorites));
        renderTrips(allTrips);
    };

    showOverlay('trip-details-view');
};

window.closeTripDetails = () => hideOverlay('trip-details-view');

window.openSettings = function() {
    const user = auth.currentUser;
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) nameInput.value = localStorage.getItem('posla-username') || (user?.displayName || "");
    
    const preview = document.getElementById('settings-avatar-preview');
    if (preview) preview.src = localStorage.getItem('posla-avatar') || (user?.photoURL || 'assets/me.jpg');

    showOverlay('settings-view');
};

window.closeSettings = () => hideOverlay('settings-view');

window.openAbout = function() {
    showOverlay('about-contact-view');
};

window.closeAbout = function() {
    hideOverlay('about-contact-view');
};

function showOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }, 400);
}

// settings n other stuff
function initPreferences() {
    // dark/light mode
    const savedTheme = localStorage.getItem('posla-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.onchange = (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('posla-theme', newTheme);
        };
    }

    // diff languages
    const savedLang = localStorage.getItem('posla-lang') || 'en';
    applyLanguage(savedLang);
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.onchange = (e) => {
            const newLang = e.target.value;
            localStorage.setItem('posla-lang', newLang);
            applyLanguage(newLang);
            renderTrips(allTrips);
        };
    }

    // save user profile
    document.getElementById('save-profile-btn')?.addEventListener('click', () => {
        const newName = document.getElementById('profile-name-input').value;
        localStorage.setItem('posla-username', newName);
        const lang = localStorage.getItem('posla-lang') || 'en';
        alert(lang === 'ar' ? 'تم حفظ التغييرات!' : 'Changes saved!');
    });

    // change avatar pic
    const avatarBtn = document.getElementById('change-avatar-btn');
    const avatarInput = document.getElementById('avatar-input');
    
    if (avatarBtn && avatarInput) {
        avatarBtn.onclick = () => avatarInput.click();
        
        avatarInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target.result;
                    localStorage.setItem('posla-avatar', dataUrl);
                    
                    const preview = document.getElementById('settings-avatar-preview');
                    const mainAvatar = document.getElementById('user-avatar');
                    if (preview) preview.src = dataUrl;
                    if (mainAvatar) mainAvatar.src = dataUrl;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    document.getElementById('contact-trigger')?.addEventListener('click', window.openAbout);
    document.getElementById('close-about-btn')?.addEventListener('click', window.closeAbout);

    document.getElementById('payment-trigger')?.addEventListener('click', () => {
        const lang = localStorage.getItem('posla-lang') || 'en';
        alert(lang === 'ar' ? 'نظام الدفع قريباً!' : 'Payment coming soon!');
    });
}

// lang setup stuff
function applyLanguage(lang) {
    const isRtl = lang === 'ar';
    document.body.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    const trans = {
        en: {
            title1: "Where do",
            title2: "you want to go?",
            search: "Discover a places",
            explore: "Explore Cities",
            categories: "Categories",
            signOut: "Sign Out",
            settingsTitle: "Profile & Settings",
            displayName: "Display Name",
            save: "Save Changes",
            preferences: "Preferences",
            support: "Support",
            contacts: "About Posla & Contact Us",
            pay: "Payment Methods",
            darkMode: "Dark Mode",
            langLabel: "Language",
            perPerson: "per person",
            statusOpen: "OPEN",
            noResults: "No results found.",
            aboutTitle: "About & Contact",
            aboutTagline: "Your trusted guide to explore Egypt's treasures.",
            aboutUsLabel: "About Posla",
            aboutDescription: "Posla is a modern travel platform dedicated to showcasing the beauty of Egypt. We help travelers find the best hotels, beaches, and adventures with ease and style.",
            devLabel: "Developer",
            foundersTitle: "Founders & Developer",
            foundersRole: "Founders:",
            devRole: "Developer:",
            connectLabel: "Connect With Us",
            contactLabels: {
                "Email": "Email",
                "WhatsApp": "WhatsApp",
                "Facebook": "Facebook",
                "Instagram": "Instagram",
                "Phone": "Phone"
            },
            tabs: { "All": "All", "hotel": "Hotels", "Popular": "Popular", "Recommended": "Recommended" },
            cats: { "hotel": "Hotel", "Beach": "Beach", "Camp": "Camp", "Mountains": "Mountain" }
        },
        ar: {
            title1: "إلى أين",
            title2: "تريد الذهاب؟",
            search: "اكتشف أماكن جديدة",
            explore: "استكشف المدن",
            categories: "التصنيفات",
            signOut: "تسجيل الخروج",
            settingsTitle: "الملف الشخصي والإعدادات",
            displayName: "اسم العرض",
            save: "حفظ التغييرات",
            preferences: "التفضيلات",
            support: "الدعم",
            contacts: "عن بوصلة & اتصل بنا",
            pay: "طرق الدفع",
            darkMode: "الوضع الليلي",
            langLabel: "اللغة",
            perPerson: "لكل فرد",
            statusOpen: "مفتوح الآن",
            noResults: "لا توجد نتائج.",
            aboutTitle: "عن بوصلة واتصل بنا",
            aboutTagline: "دليلك الموثوق لاستكشاف كنوز مصر.",
            aboutUsLabel: "عن بوصلة",
            aboutDescription: "بوصلة هي منصة سفر حديثة مخصصة لاستعراض جمال مصر. نساعد المسافرين في العثور على أفضل الفنادق والشواطئ والمغامرات بكل سهولة وأناقة.",
            devLabel: "المطور",
            foundersTitle: "المؤسسون والمطور",
            foundersRole: "المؤسسون:",
            devRole: "المطور:",
            connectLabel: "تواصل معنا",
            contactLabels: {
                "Email": "البريد الإلكتروني",
                "WhatsApp": "واتساب",
                "Facebook": "فيسبوك",
                "Instagram": "إنستجرام",
                "Phone": "الهاتف"
            },
            tabs: { "All": "الكل", "hotel": "فنادق", "Popular": "شائع", "Recommended": "موصى به" },
            cats: { "hotel": "فنادق", "Beach": "شواطئ", "Camp": "تخييم", "Mountains": "جبال" }
        }
    };

    const t = trans[lang];
    
    // text translation
    const setEl = (sel, txt) => { const el = document.querySelector(sel); if(el) el.textContent = txt; };
    const setElById = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
    const setPlaceholder = (id, txt) => { const el = document.getElementById(id); if(el) el.placeholder = txt; };

    setElById('title-part-1', t.title1);
    setElById('title-part-2', t.title2);
    setPlaceholder('search-input', t.search);
    
    const headers = document.querySelectorAll('.section-header h3');
    if(headers[0]) headers[0].textContent = t.explore;
    if(headers[1]) headers[1].textContent = t.categories;

    // tabs translate
    document.querySelectorAll('.tab-item').forEach(tab => {
        const key = tab.dataset.cat || tab.textContent;
        if(t.tabs[key]) tab.textContent = t.tabs[key];
    });

    // categories translate
    document.querySelectorAll('.category-item').forEach(cat => {
        const key = cat.dataset.cat;
        const label = cat.querySelector('.category-label');
        if(key && label && t.cats[key]) label.textContent = t.cats[key];
    });

    setEl('.settings-header h2', t.settingsTitle);
    setEl('.input-group label', t.displayName);
    setEl('#save-profile-btn', t.save);
    setEl('#label-preferences', t.preferences);
    setEl('#label-support', t.support);
    setEl('#label-darkmode', t.darkMode);
    setEl('#label-lang', t.langLabel);
    setEl('#label-payment', t.pay);
    setEl('#label-contact', t.contacts);
    setEl('.logout-full-btn', t.signOut);
    setEl('#sidebar-logout span', t.signOut);
    setEl('#label-per-person', t.perPerson);
    setEl('#label-status', t.statusOpen);
    setEl('#about-title-header', t.aboutTitle);
    setEl('#about-tagline', t.aboutTagline);
    setEl('#label-about-us', t.aboutUsLabel);
    setEl('#about-description', t.aboutDescription);
    setEl('#label-founders', t.foundersTitle);
    setEl('#role-founders', t.foundersRole);
    setEl('#role-developer', t.devRole);
    setEl('#label-connect', t.connectLabel);

    // contact grid translate
    document.querySelectorAll('.contact-card').forEach(card => {
        const span = card.querySelector('span');
        const key = span.dataset.key || span.textContent.trim();
        if (t.contactLabels[key]) {
            if (!span.dataset.key) span.dataset.key = key; // Save original for switching back
            span.textContent = t.contactLabels[key];
        }
    });

    // sidebar stuff
    const sidebarItems = document.querySelectorAll('.sidebar-nav .nav-item span');
    if(sidebarItems[0]) sidebarItems[0].textContent = lang === 'ar' ? 'استكشاف' : 'Explore';
    if(sidebarItems[1]) sidebarItems[1].textContent = lang === 'ar' ? 'المفضلة' : 'Favorites';
    if(sidebarItems[2]) sidebarItems[2].textContent = lang === 'ar' ? 'رحلاتي' : 'My Trips';
    if(sidebarItems[3]) sidebarItems[3].textContent = lang === 'ar' ? 'الإعدادات' : 'Settings';

    // footer nav stuff
    const mobItems = document.querySelectorAll('.mobile-nav .mobile-nav-item span');
    if(mobItems[0]) mobItems[0].textContent = lang === 'ar' ? 'استكشاف' : 'Explore';
    if(mobItems[1]) mobItems[1].textContent = lang === 'ar' ? 'المفضلة' : 'Favorites';
    if(mobItems[2]) mobItems[2].textContent = lang === 'ar' ? 'رحلاتي' : 'My Trips';
    if(mobItems[3]) mobItems[3].textContent = lang === 'ar' ? 'الإعدادات' : 'Settings';
}

// global helper funcs
window.updateMainGalleryImage = function(src, el) {
    const main = document.getElementById('detail-main-image');
    if (main) main.src = src;
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
};

// user auth
onAuthStateChanged(auth, (user) => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!user && !isLocal && window.location.protocol !== 'file:') {
        window.location.href = 'index.html';
    } else {
        const avatar = document.getElementById('user-avatar');
        if (avatar) avatar.src = localStorage.getItem('posla-avatar') || (user?.photoURL || 'assets/me.jpg');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // home view tabs
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.tab-item.active')?.classList.remove('active');
            tab.classList.add('active');
            currentCategory = tab.dataset.cat || tab.textContent;
            filterTrips();
        });
    });

    // grid of categories
    const catItems = document.querySelectorAll('.category-item');
    catItems.forEach(item => {
        item.addEventListener('click', () => {
            currentCategory = item.dataset.cat;
            // Update tabs active state
            document.querySelectorAll('.tab-item').forEach(t => {
                t.classList.toggle('active', t.dataset.cat === currentCategory);
            });
            filterTrips();
        });
    });

    // trip card clicks
    document.getElementById('trips-container')?.addEventListener('click', (e) => {
        const card = e.target.closest('.city-card');
        const heartBtn = e.target.closest('.heart-btn');
        
        if (card && !heartBtn) {
            const tripId = card.dataset.id;
            if (tripId) window.openTripDetails(tripId);
        }
    });

    // all listeners
    document.getElementById('search-input')?.addEventListener('input', filterTrips);
    document.getElementById('close-details-btn')?.addEventListener('click', window.closeTripDetails);
    document.getElementById('avatar-trigger')?.addEventListener('click', window.openSettings);
    document.getElementById('close-settings-btn')?.addEventListener('click', window.closeSettings);
    
    const handleLogout = async () => {
        await signOut(auth);
        window.location.href = 'index.html';
    };
    document.getElementById('settings-logout')?.addEventListener('click', handleLogout);
    document.getElementById('sidebar-logout')?.addEventListener('click', handleLogout);

    // side nav bar
    document.getElementById('nav-explore')?.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('nav-explore').classList.add('active');
        currentCategory = 'All';
        renderTrips(allTrips);
    });

    document.getElementById('nav-favorites')?.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('nav-favorites').classList.add('active');
        const favs = allTrips.filter(t => favorites.includes(String(t.id)));
        renderTrips(favs);
    });

    document.getElementById('nav-settings')?.addEventListener('click', window.openSettings);
    document.getElementById('nav-trips')?.addEventListener('click', () => alert('My Trips feature coming soon!'));

    // mobile nav logic
    const syncMobileNav = (activeId) => {
        document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(activeId)?.classList.add('active');
    };

    document.getElementById('mob-nav-explore')?.addEventListener('click', () => {
        syncMobileNav('mob-nav-explore');
        currentCategory = 'All';
        renderTrips(allTrips);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('mob-nav-favorites')?.addEventListener('click', () => {
        syncMobileNav('mob-nav-favorites');
        const favs = allTrips.filter(t => favorites.includes(String(t.id)));
        renderTrips(favs);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('mob-nav-trips')?.addEventListener('click', () => {
        alert('My Trips feature coming soon!');
    });

    document.getElementById('mob-nav-settings')?.addEventListener('click', window.openSettings);

    // buttons 4 map layers
    let mapType = '';
    document.getElementById('map-layers-btn')?.addEventListener('click', () => {
        mapType = mapType === '' ? 'k' : '';
        const iframe = document.getElementById('detail-map-iframe');
        if (iframe && iframe.src) {
            const url = new URL(iframe.src);
            url.searchParams.set('t', mapType);
            iframe.src = url.toString();
        }
    });
    document.getElementById('map-nav-btn')?.addEventListener('click', () => {
        const iframe = document.getElementById('detail-map-iframe');
        if (iframe && iframe.src) {
            const url = new URL(iframe.src);
            const query = url.searchParams.get('q');
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`, '_blank');
        }
    });

    initPreferences();
    loadTrips();
});
