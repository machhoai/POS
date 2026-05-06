// =============================================================================
// Firebase Admin SDK Initialization — Cloud Functions Only
// =============================================================================
// This initializes the Firebase Admin SDK for use within Cloud Functions.
// The Admin SDK uses Application Default Credentials (ADC) when deployed
// to Cloud Functions, so no explicit service account is needed in production.
// =============================================================================

import * as admin from "firebase-admin";

// Initialize only once (Cloud Functions may reuse instances across invocations)
if (!admin.apps.length) {
  admin.initializeApp();
}

/** Firestore database instance (Admin SDK — full read/write access). */
export const db = admin.firestore();

export { admin };
