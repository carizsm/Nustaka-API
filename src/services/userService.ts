import { firestore } from "../config/firebase";
import { User, UserWithId } from "../interfaces";

// User Collection Reference
const userCollection = firestore.collection("users");

// Get All Users
export const getAllUsers = async (): Promise<UserWithId[]> => {
  const snapshot = await userCollection.get();
  const users: UserWithId[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data() as User
  }));
  return users;
};

// Get User By ID
export const getUserById = async (id: string): Promise<UserWithId | null> => {
  const doc = await userCollection.doc(id).get();
  return doc.exists ? { id: doc.id, ...(doc.data() as User) } : null;
};

// Create User
export const createUser = async (userData: User): Promise<UserWithId> => {
  const docRef = await userCollection.add(userData);
  const userWithId: UserWithId = {
    id: docRef.id,
    ...userData
  };
  return userWithId;
};

// Update User
export const updateUser = async (id: string, userData: Partial<User>): Promise<boolean> => {
  try {
    await userCollection.doc(id).update(userData);
    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    return false;
  }
};

// Delete User
export const deleteUser = async (id: string): Promise<boolean> => {
  try {
    await userCollection.doc(id).delete();
    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    return false;
  }
};

// Get User by Email
export const getUserByEmail = async (email: string): Promise<UserWithId | null> => {
  const snapshot = await userCollection.where("email", "==", email).limit(1).get();
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as User) };
};