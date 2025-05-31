import admin from '../config/firebase';  // import default export
import { User, UserWithId } from '../interfaces';

const firestore = admin.firestore();

// User Collection Reference
const userCollection = firestore.collection('users');

// Get All Users
export const getAllUsers = async (): Promise<UserWithId[]> => {
  const snapshot = await userCollection.get();
  const users: UserWithId[] = snapshot.docs.map((doc): UserWithId => ({
    id: doc.id,
    ...(doc.data() as User)
  }));
  return users;
};

// Get User By ID
export const getUserById = async (id: string): Promise<UserWithId | null> => {
  const docSnap = await userCollection.doc(id).get();
  return docSnap.exists
    ? { id: docSnap.id, ...(docSnap.data() as User) }
    : null;
};

// Create User
export const createUser = async (userData: User): Promise<UserWithId> => {
  const docRef = await userCollection.add(userData);
  return { id: docRef.id, ...userData };
};

// Update User
export const updateUser = async (
  id: string,
  userData: Partial<User> // Menerima Partial<User> yang mungkin berisi latitude/longitude
): Promise<boolean> => {
  try {
    // Cek apakah user ada sebelum update
    const userRef = userCollection.doc(id);
    const doc = await userRef.get();
    if (!doc.exists) {
        console.warn(`User with ID ${id} not found for update.`);
        return false; // User tidak ditemukan
    }

    await userRef.update(userData); // userData akan berisi field baru jika dikirim dari controller
    return true;
  } catch (error) {
    console.error(`Error updating user ${id}:`, error);
    return false;
  }
};

// Delete User
export const deleteUser = async (id: string): Promise<boolean> => {
  try {
    await userCollection.doc(id).delete();
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
};

// Get User by Email
export const getUserByEmail = async (
  email: string
): Promise<UserWithId | null> => {
  const snapshot = await userCollection.where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as User) };
};
