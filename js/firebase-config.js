import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAh9vT0jKajmFI0YugDfvVIx_baN3LQjDg",
  authDomain: "posla-trips.firebaseapp.com",
  projectId: "posla-trips",
  storageBucket: "posla-trips.firebasestorage.app",
  messagingSenderId: "885199085416",
  appId: "1:885199085416:web:5bed7f2bb339b2b56180dd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, storage, googleProvider, signInWithPopup, onAuthStateChanged, signOut };
export { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy };
export { ref, uploadBytes, getDownloadURL, deleteObject };

