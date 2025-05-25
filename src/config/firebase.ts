// src/config/firebase.ts
import * as admin from 'firebase-admin';
import serviceAccount from './firebase-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: serviceAccount.project_id,
});

export const db = admin.firestore();

// Jika memang nanti butuh storage atau auth, Anda bisa mengekspornya kembali:
// export const auth = admin.auth();
// export const storage = admin.storage();

export default admin;
