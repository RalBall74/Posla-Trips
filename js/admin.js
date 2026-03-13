import { db, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot } from './firebase-config.js';

const ADMIN_PASS = 'Poslaengasaa4';
const TRIPS_COLLECTION = 'trips';
let tripsData = [];
let isAuthenticated = false;
let unsubscribe = null;

// image state stuff
let mainImageUrl = '';
let galleryItems = [];        

// lock screen logic
function initLockScreen() {
    const passInput = document.getElementById('lock-password');
    const submitBtn = document.getElementById('lock-submit');
    const errorEl = document.getElementById('lock-error');
    const eyeBtn = document.getElementById('lock-eye-btn');

    eyeBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        const icon = eyeBtn.querySelector('[data-lucide], svg');
        if (icon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', isPass ? 'eye' : 'eye-off');
            icon.replaceWith(newIcon);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
    submitBtn.addEventListener('click', attemptLogin);

    function attemptLogin() {
        const val = passInput.value.trim();
        if (val === ADMIN_PASS) {
            isAuthenticated = true;
            document.getElementById('lock-screen').style.animation = 'lockFadeOut 0.4s forwards';
            setTimeout(() => {
                document.getElementById('lock-screen').classList.add('hidden');
                document.getElementById('admin-dashboard').classList.remove('hidden');
                startRealtimeListener();
            }, 400);
        } else {
            errorEl.textContent = 'Wrong password. Try again.';
            errorEl.classList.add('shake');
            passInput.value = '';
            passInput.focus();
            setTimeout(() => errorEl.classList.remove('shake'), 500);
        }
    }
}

const style = document.createElement('style');
style.textContent = `@keyframes lockFadeOut { from { opacity: 1; } to { opacity: 0; } }`;
document.head.appendChild(style);

// get trips from firestore real-time
function startRealtimeListener() {
    if (!isAuthenticated) return;
    if (unsubscribe) unsubscribe();

    const tripsRef = collection(db, TRIPS_COLLECTION);
    unsubscribe = onSnapshot(tripsRef, (snapshot) => {
        tripsData = [];
        const seen = new Set();
        snapshot.forEach((docSnap) => {
            const docId = docSnap.id;
            if (seen.has(docId)) return;
            seen.add(docId);
            const data = docSnap.data();
            data.id = docId;
            tripsData.push(data);
        });
        tripsData.sort((a, b) => Number(a.id) - Number(b.id));
        renderTrips();
    }, (err) => {
        console.error('admin: firestore error:', err);
        showToast('Error syncing with database', true);
    });
}

// render the trips grid
function renderTrips(filter = '') {
    const grid = document.getElementById('admin-trips-grid');
    const empty = document.getElementById('empty-state');
    const countEl = document.getElementById('trip-count');

    let filtered = tripsData;
    if (filter) {
        const q = filter.toLowerCase();
        filtered = tripsData.filter(t =>
            (t.name && t.name.toLowerCase().includes(q)) ||
            (t.nameAr && t.nameAr.includes(q)) ||
            (t.location && t.location.toLowerCase().includes(q)) ||
            (t.category && t.category.toLowerCase().includes(q))
        );
    }

    countEl.textContent = `${tripsData.length} trip${tripsData.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = filtered.map((trip, idx) => `
        <div class="trip-card" style="animation-delay: ${idx * 0.05}s">
            <img class="trip-card-image" src="${trip.image || ''}" alt="${trip.name || ''}"
                 onerror="this.src='https://placehold.co/400x200/1e293b/64748b?text=No+Image'">
            <div class="trip-card-body">
                <div class="trip-card-top">
                    <div class="trip-card-name">${trip.name || 'Unnamed'}</div>
                    <span class="trip-card-category">${trip.category || 'N/A'}</span>
                </div>
                <div class="trip-card-location">
                    <i data-lucide="map-pin"></i>
                    <span>${trip.location || 'Unknown'}</span>
                </div>
                <div class="trip-card-price">EGP ${trip.price || '0'}</div>
                <div class="trip-card-actions">
                    <button class="card-btn card-btn-edit" data-edit-id="${trip.id}">
                        <i data-lucide="pencil"></i> Edit
                    </button>
                    <button class="card-btn card-btn-delete" data-delete-id="${trip.id}">
                        <i data-lucide="trash-2"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    grid.querySelectorAll('.card-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.editId));
    });
    grid.querySelectorAll('.card-btn-delete').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.deleteId));
    });
}

// image process (resize n base64)
async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize if too large to stay under Firestore 1MB limit
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Heavy compression for base64
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

// main image upload ui stuff
function initMainImageUpload() {
    const zone = document.getElementById('main-img-zone');
    const input = document.getElementById('main-img-input');
    const preview = document.getElementById('main-img-preview');
    const placeholder = document.getElementById('main-img-placeholder');
    const clearBtn = document.getElementById('main-img-clear');

    zone.addEventListener('click', (e) => {
        if (e.target === clearBtn || clearBtn.contains(e.target)) return;
        input.click();
    });

    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        
        showToast('Processing image...', false);
        const base64 = await processImage(file);
        mainImageUrl = base64;
        
        preview.src = base64;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        clearBtn.classList.remove('hidden');
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mainImageUrl = '';
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        clearBtn.classList.add('hidden');
        input.value = '';
    });
}

function setMainImagePreview(url) {
    const preview = document.getElementById('main-img-preview');
    const placeholder = document.getElementById('main-img-placeholder');
    const clearBtn = document.getElementById('main-img-clear');
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        clearBtn.classList.remove('hidden');
        mainImageUrl = url;
    } else {
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        clearBtn.classList.add('hidden');
        mainImageUrl = '';
    }
}

// gallery pick ui
function initGalleryUpload() {
    const addBtn = document.getElementById('gallery-add-btn');
    const input = document.getElementById('gallery-input');

    addBtn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
        const files = Array.from(input.files);
        showToast(`Processing ${files.length} images...`, false);
        
        for (const file of files) {
            const base64 = await processImage(file);
            galleryItems.push({ url: base64, isNew: true });
        }
        renderGalleryPreviews();
        input.value = '';
    });
}

function renderGalleryPreviews() {
    const container = document.getElementById('gallery-previews');
    container.innerHTML = galleryItems.map((item, idx) => `
        <div class="gallery-thumb-wrap">
            <img src="${item.url}" alt="gallery">
            <button class="gallery-thumb-remove" data-idx="${idx}">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.gallery-thumb-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            galleryItems.splice(idx, 1);
            renderGalleryPreviews();
        });
    });
}

function setGalleryItems(urls) {
    galleryItems = urls.map(url => ({ url, isNew: false }));
    renderGalleryPreviews();
}

// add/edit modals
function openAddModal() {
    document.getElementById('modal-title').textContent = 'Add New Trip';
    document.getElementById('edit-trip-id').value = '';
    clearForm();
    document.getElementById('trip-modal').classList.remove('hidden');
}

function openEditModal(id) {
    const trip = tripsData.find(t => String(t.id) === String(id));
    if (!trip) return;

    document.getElementById('modal-title').textContent = 'Edit Trip';
    document.getElementById('edit-trip-id').value = trip.id;
    document.getElementById('trip-name').value = trip.name || '';
    document.getElementById('trip-nameAr').value = trip.nameAr || '';
    document.getElementById('trip-location').value = trip.location || '';
    document.getElementById('trip-locationAr').value = trip.locationAr || '';
    document.getElementById('trip-price').value = trip.price || '';
    document.getElementById('trip-category').value = trip.category || 'hotel';
    document.getElementById('trip-address').value = trip.address || '';
    document.getElementById('trip-openTime').value = trip.openTime || '';
    document.getElementById('trip-mapUrl').value = trip.mapUrl || '';
    document.getElementById('trip-description').value = trip.description || '';

    setMainImagePreview(trip.image || '');
    setGalleryItems(trip.gallery || []);

    document.getElementById('trip-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('trip-modal').classList.add('hidden');
}

function clearForm() {
    ['trip-name', 'trip-nameAr', 'trip-location', 'trip-locationAr',
     'trip-price', 'trip-address', 'trip-openTime', 'trip-mapUrl', 'trip-description'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('trip-category').value = 'hotel';
    setMainImagePreview('');
    galleryItems = [];
    renderGalleryPreviews();
}

// save logic
async function saveTrip() {
    const name = document.getElementById('trip-name').value.trim();
    const location = document.getElementById('trip-location').value.trim();
    const price = document.getElementById('trip-price').value.trim();

    if (!name || !location || !price) {
        showToast('Please fill Name, Location & Price', true);
        return;
    }

    const saveBtn = document.getElementById('modal-save');
    saveBtn.disabled = true;
    saveBtn.querySelector('span').textContent = 'Saving...';

    try {
        const editId = document.getElementById('edit-trip-id').value;
        const tripId = editId || String(tripsData.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1);

        const tripObj = {
            name,
            nameAr: document.getElementById('trip-nameAr').value.trim(),
            location,
            locationAr: document.getElementById('trip-locationAr').value.trim(),
            price,
            address: document.getElementById('trip-address').value.trim(),
            openTime: document.getElementById('trip-openTime').value.trim(),
            description: document.getElementById('trip-description').value.trim(),
            category: document.getElementById('trip-category').value,
            image: mainImageUrl, // Base64 string
            gallery: galleryItems.map(item => item.url), // Array of base64 strings
        };

        const mapUrl = document.getElementById('trip-mapUrl').value.trim();
        if (mapUrl) tripObj.mapUrl = mapUrl;

        const tripDoc = doc(db, TRIPS_COLLECTION, tripId);
        await setDoc(tripDoc, tripObj);

        showToast(editId ? 'Trip updated!' : 'Trip added!');
        closeModal();
    } catch (err) {
        console.error('save error:', err);
        showToast('Failed to save trip (limit 1MB)', true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.querySelector('span').textContent = 'Save Trip';
    }
}

// del trip stuff
let deleteTargetId = null;

function openDeleteModal(id) {
    deleteTargetId = String(id);
    const trip = tripsData.find(t => String(t.id) === deleteTargetId);
    document.getElementById('delete-trip-name').textContent = trip ? trip.name : '';
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    deleteTargetId = null;
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    try {
        const tripDoc = doc(db, TRIPS_COLLECTION, deleteTargetId);
        await deleteDoc(tripDoc);
        closeDeleteModal();
        showToast('Trip deleted!');
    } catch (err) {
        console.error('delete error:', err);
        showToast('Failed to delete trip', true);
    }
}

// toast popups
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    msgEl.textContent = msg;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 2500);
}

// logout/lock dash
function lockDashboard() {
    isAuthenticated = false;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    document.getElementById('admin-dashboard').classList.add('hidden');
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.classList.remove('hidden');
    lockScreen.style.animation = 'lockFadeIn 0.4s ease';
    document.getElementById('lock-password').value = '';
    document.getElementById('lock-error').textContent = '';
}

// seed (off 4 now)
async function seedFromJSON() {
    showToast('Seed disabled in Base64 mode', true);
}

// init everything
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    initLockScreen();
    initMainImageUpload();
    initGalleryUpload();

    document.getElementById('admin-search').addEventListener('input', (e) => renderTrips(e.target.value));
    document.getElementById('add-trip-btn').addEventListener('click', openAddModal);
    document.getElementById('seed-btn')?.addEventListener('click', seedFromJSON);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveTrip);
    document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm').addEventListener('click', confirmDelete);
    document.getElementById('logout-btn').addEventListener('click', lockDashboard);

    document.getElementById('trip-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('delete-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDeleteModal();
    });

    window.addEventListener('popstate', () => {
        if (!isAuthenticated) {
            document.getElementById('admin-dashboard').classList.add('hidden');
            document.getElementById('lock-screen').classList.remove('hidden');
        }
    });
});
