import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
export const dataMode = import.meta.env.MODE === 'test' ? 'demo' : (import.meta.env.VITE_DATA_MODE ?? 'emulator');
export const demoMode = dataMode === 'demo';
let app: FirebaseApp | undefined;
export function firebaseClient() {
  if (demoMode || !['emulator', 'firebase'].includes(dataMode))
    throw new Error('Choose a valid Firebase environment.');
  const env = import.meta.env;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const config = { projectId, apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID };
  if (Object.values(config).some((v) => !v))
    throw new Error('Firebase configuration is missing. Configure the workspace environment.');
  if (dataMode === 'emulator' && (projectId !== 'demo-moneykawkaw' ||
      !['localhost', '127.0.0.1'].includes(location.hostname)))
    throw new Error('Emulator mode requires the isolated local demo project.');
  if (dataMode === 'firebase' && projectId.startsWith('demo-'))
    throw new Error('A demo project cannot connect to live Firebase.');
  if (!app) {
    app = initializeApp(config);
    if (dataMode === 'emulator') {
      connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
      connectFunctionsEmulator(getFunctions(app, env.VITE_FIREBASE_REGION || 'us-central1'), '127.0.0.1', 5001);
      connectStorageEmulator(getStorage(app), '127.0.0.1', 9199);
    }
  }
  return { auth: getAuth(app), db: getFirestore(app), storage: getStorage(app),
    functions: getFunctions(app, env.VITE_FIREBASE_REGION || 'us-central1') };
}
