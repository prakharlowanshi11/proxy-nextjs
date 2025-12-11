const APP_SCRIPT_SRC = "https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js";
const AUTH_SCRIPT_SRC = "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth-compat.js";

type FirebaseUser = {
  getIdToken: () => Promise<string>;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  uid?: string;
};

type FirebaseAuthCredential = {
  user?: FirebaseUser;
};

type FirebaseAuth = {
  signInWithPopup: (provider: unknown) => Promise<FirebaseAuthCredential>;
  signOut: () => Promise<void>;
  onAuthStateChanged: (callback: (user: FirebaseUser | null) => void) => () => void;
  currentUser: FirebaseUser | null;
};

type FirebaseNamespace = {
  auth: {
    (): FirebaseAuth;
    GoogleAuthProvider: new () => unknown;
  };
  apps?: Array<unknown>;
  initializeApp: (config: typeof firebaseConfig) => void;
};

declare global {
  interface Window {
    firebase?: FirebaseNamespace;
  }
}

let firebasePromise: Promise<FirebaseNamespace> | null = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_CONFIG_APP_ID,
};

const isBrowser = () => typeof window !== "undefined";

function appendScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("Scripts can only be loaded in the browser"));
      return;
    }

    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.id = id;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureFirebaseLoaded(): Promise<FirebaseNamespace> {
  if (!isBrowser()) {
    throw new Error("Firebase is only available in the browser environment");
  }

  await appendScript(APP_SCRIPT_SRC, "firebase-app-compat");
  await appendScript(AUTH_SCRIPT_SRC, "firebase-auth-compat");

  const firebase = window.firebase;
  if (!firebase) {
    throw new Error("Firebase SDK failed to initialize");
  }

  if (!firebase.apps?.length) {
    firebase.initializeApp(firebaseConfig);
  }

  return firebase;
}

export function getFirebase(): Promise<FirebaseNamespace> {
  if (!firebasePromise) {
    firebasePromise = ensureFirebaseLoaded();
  }
  return firebasePromise;
}
