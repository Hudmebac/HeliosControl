
import { db } from '@/lib/firebase';
import type { EVChargerFirebaseSchedule } from '@/lib/types';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const SCHEDULES_COLLECTION = 'evChargerSchedules';

// Type guard for Firebase Timestamps
function isFirebaseTimestamp(value: any): value is Timestamp {
  return value && typeof value.toDate === 'function';
}


export const addSchedule = async (chargerId: string, scheduleData: Omit<EVChargerFirebaseSchedule, 'id' | 'chargerId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (!chargerId) throw new Error("Charger ID is required to add a schedule.");
  try {
    const docRef = await addDoc(collection(db, SCHEDULES_COLLECTION), {
      ...scheduleData,
      chargerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding schedule to Firestore: ", error);
    throw error;
  }
};

export const updateSchedule = async (scheduleId: string, scheduleData: Partial<Omit<EVChargerFirebaseSchedule, 'id' | 'chargerId' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  try {
    const scheduleRef = doc(db, SCHEDULES_COLLECTION, scheduleId);
    await updateDoc(scheduleRef, {
        ...scheduleData,
        updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating schedule in Firestore: ", error);
    throw error;
  }
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, SCHEDULES_COLLECTION, scheduleId));
  } catch (error) {
    console.error("Error deleting schedule from Firestore: ", error);
    throw error;
  }
};

export const getSchedulesSubscription = (
  chargerId: string,
  callback: (schedules: EVChargerFirebaseSchedule[]) => void
): (() => void) => { // Returns an unsubscribe function
  if (!chargerId) {
    console.warn("Charger ID not provided for schedule subscription. Returning empty list and no subscription.");
    callback([]);
    return () => {}; // Return a no-op unsubscribe function
  }

  const q = query(
    collection(db, SCHEDULES_COLLECTION),
    where('chargerId', '==', chargerId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const schedules = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Timestamps to ISO strings or Date objects for easier handling in the UI
        const createdAt = data.createdAt && isFirebaseTimestamp(data.createdAt) ? data.createdAt.toDate().toISOString() : null;
        const updatedAt = data.updatedAt && isFirebaseTimestamp(data.updatedAt) ? data.updatedAt.toDate().toISOString() : null;
        
        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
        } as EVChargerFirebaseSchedule;
      });
    callback(schedules);
  }, (error) => {
    console.error("Error fetching schedules from Firestore: ", error);
    // Optionally, notify the user via toast or a global error state
    callback([]); // Return empty list on error
  });

  return unsubscribe; // Return the unsubscribe function
};
