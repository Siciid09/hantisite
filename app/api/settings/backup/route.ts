// File: app/api/settings/backup/route.ts
// Description: API for creating, restoring, and checking backups.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin, storageAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { Readable } from 'stream';

// Helper function
async function getAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized.");
  }
  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await authAdmin.verifyIdToken(token);
  const uid = decodedToken.uid;
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new Error("User not found.");

  const userData = userDoc.data()!;
  const storeId = userData.storeId;
  const role = userData.role;
  if (!storeId) throw new Error("User has no store.");
  if (role !== "admin") throw new Error("Permission Denied: Admin role required."); // Only admins can backup/restore

  return { storeId };
}

// Helper to get storage file ref
function getBackupFileRef(storeId: string) {
  return storageAdmin.bucket().file(`backups/${storeId}/hantikaab_backup.json`);
}

// -----------------------------------------------------------------------------
// 📋 GET - Get Last Backup Date
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await getAuth(request);
    const file = getBackupFileRef(storeId);
    const [metadata] = await file.getMetadata();
    
    return NextResponse.json({ lastBackupDate: metadata.timeCreated });

  } catch (error: any) {
    if (error.code === 404) {
      return NextResponse.json({ lastBackupDate: null }); // No backup found
    }
    console.error("[BACKUP API GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ➕ POST - Create New Backup
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { storeId } = await getAuth(request);
    
    const collectionsToBackup = [
      'products', 'sales', 'debts', 'incomes', 
      'expenses', 'notes', 'categories'
    ];
    let backupData: { [key: string]: any[] } = {};

    for (const collectionName of collectionsToBackup) {
      const snapshot = await firestoreAdmin
          .collection(collectionName)
          .where('storeId', '==', storeId)
          .get();
      
      backupData[collectionName] = snapshot.docs.map(doc => {
        let data = doc.data();
        data['id'] = doc.id; // Store ID for restore
        return data;
      });
    }

    const jsonString = JSON.stringify(backupData);
    const file = getBackupFileRef(storeId);
    
    // Stream upload
    const stream = Readable.from(jsonString);
    await new Promise((resolve, reject) => {
      stream.pipe(file.createWriteStream({ contentType: 'application/json' }))
        .on('finish', resolve)
        .on('error', reject);
    });

    return NextResponse.json({ success: true, message: "Backup created." });

  } catch (error: any) {
    console.error("[BACKUP API POST] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🔄 PUT - Restore from Backup
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const { storeId } = await getAuth(request);

    // 1. Download backup file
    const file = getBackupFileRef(storeId);
    const [data] = await file.download();
    const jsonString = data.toString('utf8');
    const backupData = JSON.parse(jsonString);

    const batch = firestoreAdmin.batch();

    // 2. Iterate and restore
    for (const collectionName in backupData) {
      const documents: any[] = backupData[collectionName];

      // First, delete all existing data for this store in this collection
      const existingDocsSnap = await firestoreAdmin.collection(collectionName).where('storeId', '==', storeId).get();
      existingDocsSnap.docs.forEach(doc => batch.delete(doc.ref));

      // Second, add all backed-up data
      for (const docData of documents) {
        const docId = docData['id'] as string;
        delete docData['id']; // Remove the temp ID
        
        const docRef = firestoreAdmin.collection(collectionName).doc(docId);
        batch.set(docRef, docData);
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, message: "Restore complete." });

  } catch (error: any) {
    console.error("[BACKUP API PUT] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}