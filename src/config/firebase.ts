import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

import serviceAccount from './firebase-key.json';
const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
};

// Inisialisasi Firebase
admin.initializeApp(firebaseConfig);

// Export firestore untuk digunakan di service
export const firestore = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;