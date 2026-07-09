// Firebase seam — wired to project `transactiq-746f9` but intentionally lazy.
// The demo runs entirely on in-memory seed data; nothing here is called yet.
// When we move to real persistence: `npm i firebase`, uncomment, drop the stub.
//
// import { initializeApp } from 'firebase/app'
// import { getFirestore } from 'firebase/firestore'
// import { getAuth } from 'firebase/auth'
//
// const app = initializeApp(firebaseConfig)
// export const db = getFirestore(app)
// export const auth = getAuth(app)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'transactiq-746f9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey)
