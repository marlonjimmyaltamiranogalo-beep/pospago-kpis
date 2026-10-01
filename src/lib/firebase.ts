import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured databaseId if present
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export interface SavedSettings {
  excludedExtensions: string[];
  lunchStart: string;
  lunchEnd: string;
  excludeLunch: boolean;
  minDeadTimeMinutes: number;
  lastUpdated?: string;
}

const SETTINGS_DOC_REF = () => doc(db, 'app_config', 'general_settings');

/**
 * Save exclusion and shift settings to Firebase Firestore
 */
export async function saveSettingsToFirebase(settings: SavedSettings): Promise<void> {
  try {
    await setDoc(SETTINGS_DOC_REF(), {
      ...settings,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn('Could not save settings to Firebase Firestore:', error);
  }
}

/**
 * Load exclusion and shift settings from Firebase Firestore
 */
export async function loadSettingsFromFirebase(): Promise<SavedSettings | null> {
  try {
    const snap = await getDoc(SETTINGS_DOC_REF());
    if (snap.exists()) {
      return snap.data() as SavedSettings;
    }
    return null;
  } catch (error) {
    console.warn('Could not load settings from Firebase Firestore:', error);
    return null;
  }
}

/**
 * Subscribe to real-time changes in settings
 */
export function subscribeToFirebaseSettings(onUpdate: (settings: SavedSettings) => void) {
  try {
    return onSnapshot(SETTINGS_DOC_REF(), (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as SavedSettings);
      }
    }, (error) => {
      console.warn('Firestore settings listener error:', error);
    });
  } catch (error) {
    console.warn('Could not create Firestore subscription:', error);
    return () => {};
  }
}
