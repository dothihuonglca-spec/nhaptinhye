/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import appletConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyAWFbMZcUphCH7jhcsePnQG4WZ6Lk7uSdk",
  authDomain: appletConfig.authDomain || "even-aria-rtn3v.firebaseapp.com",
  projectId: appletConfig.projectId || "even-aria-rtn3v",
  storageBucket: appletConfig.storageBucket || "even-aria-rtn3v.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "376619303274",
  appId: appletConfig.appId || "1:376619303274:web:f01448439e8ea7252b2513"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const rawDbId = appletConfig.firestoreDatabaseId;
const databaseId = (!rawDbId || rawDbId === '(default)') ? undefined : rawDbId;

// Initialize Firestore with memory local cache to prevent quota loops
export const db = databaseId 
  ? initializeFirestore(app, { localCache: memoryLocalCache() }, databaseId)
  : initializeFirestore(app, { localCache: memoryLocalCache() });

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

let isQuotaExceededFlag = false;

export function isQuotaExceeded(): boolean {
  return isQuotaExceededFlag;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const quotaHit = message.includes('resource-exhausted') || message.includes('Quota limit exceeded') || message.includes('Quota exceeded');

  if (quotaHit) {
    isQuotaExceededFlag = true;
    console.info(`[Offline Mode] Firestore quota exceeded for ${operationType} on ${path}. Data is saved locally in browser storage.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };

  console.warn('Firestore Operation Info: ', errInfo.error);
}

/**
 * Executes a Firestore write operation safely.
 * If Firestore quota is exceeded, catches the error cleanly and relies on local state / localStorage fallback.
 */
export async function safeFirestoreWrite<T>(
  operationFn: () => Promise<T>,
  fallbackFn?: () => void
): Promise<T | null> {
  try {
    const result = await operationFn();
    return result;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, null);
    if (fallbackFn) {
      try { fallbackFn(); } catch (e) {}
    }
    return null;
  }
}

