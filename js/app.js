import { auth, googleProvider, signInWithPopup, onAuthStateChanged } from './firebase-config.js';

class PoslaApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupAuth();
        this.setupUI();
    }

    setupAuth() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // u r logged in
                console.log("Posla Auth: User logged in:", user.email);
                
                // go to home page
                // only go home if u r here
                if (document.getElementById('auth-overlay')) {
                    window.location.href = 'home.html';
                }
            } else {
                // u r logged out
                console.log("No user logged in.");
                const authOverlay = document.getElementById('auth-overlay');
                if (authOverlay) authOverlay.classList.remove('hidden');
            }
        });
    }

    async login() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Logged in gracefully:", result.user);
        } catch (error) {
            console.error("Login Error:", error);
            if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/invalid-api-key") {
                alert("Login Failed! Please configure Firebase in js/firebase-config.js\n\nError: " + error.message);
            } else if (error.code === "auth/invalid-api-key") {
                alert("Please add your valid Firebase Configuration in js/firebase-config.js to allow login.");
            }
        }
    }

    setupUI() {
        // connect google btn
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }

        // icons start
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// start app and let window see it
window.app = new PoslaApp();
