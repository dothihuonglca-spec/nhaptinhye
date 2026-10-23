import { db } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { OFFICIAL_5_DEPARTMENTS } from '../constants/officialPersonnel';
import { Department } from '../types/user';

export async function seedDepartmentsIfEmpty(): Promise<Department[]> {
  try {
    const deptsCol = collection(db, 'departments');
    const snapshot = await getDocs(deptsCol);
    
    if (snapshot.empty) {
      for (const dept of OFFICIAL_5_DEPARTMENTS) {
        await setDoc(doc(deptsCol, dept.id), dept);
      }
      return OFFICIAL_5_DEPARTMENTS;
    } else {
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Department));
    }
  } catch (err) {
    console.warn('seedDepartmentsIfEmpty warning:', err);
    return OFFICIAL_5_DEPARTMENTS;
  }
}
