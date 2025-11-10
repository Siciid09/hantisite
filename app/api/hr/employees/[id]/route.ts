// File: app/api/hr/employees/[id]/route.ts
//
// --- LATEST FIX (TypeScript & Bug) ---
// 1. (BUILD FIX) Changed signatures for PUT/DELETE to accept `params: Promise`
//    to match Next.js 16 (Turbopack) requirements.
// 2. (BUG FIX) Changed PUT function to use the secure `storeId` from `getAuth`
//    instead of the insecure `body.storeId` when updating salaries.
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Helper function (Copied from main route.ts)
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

  // Return role for permission checks by the caller
  return { storeId, uid, userName: userData.name || "System", role };
}

// Helper to get store-specific sub-collection
function getStoreCollection(storeId: string, collectionName: string) {
    return firestoreAdmin.collection("stores").doc(storeId).collection(collectionName);
}

// -----------------------------------------------------------------------------
// ✏️ PUT - Update Employee
// -----------------------------------------------------------------------------
export async function PUT(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> } // <-- (BUILD FIX) Accept Promise
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  const params = await context.params; // <-- (BUILD FIX) Await params
  const employeeId = params.id; // <-- (BUILD FIX) Use resolved params

  if (!employeeId) {
    return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
  }

  try {
    // <-- (BUG FIX) Get storeId from auth *first*
    const { storeId, role } = await getAuth(request);

    // --- Permission Check ---
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin or Manager role required." }, { status: 403 });
    }
    
    const body = await request.json();
    const { name, email, phone, role: newRole, address, gender, baseSalary } = body;

    // 1. Prepare Auth update
    let authUpdates: any = {};
    if (name) authUpdates.displayName = name;
    if (email) authUpdates.email = email;
    // Note: Password changes should be a separate, more secure process (e.g., reset link)
    // Do not update password here unless explicitly handled
    
    if (Object.keys(authUpdates).length > 0) {
        await authAdmin.updateUser(employeeId, authUpdates);
    }

    // 2. Prepare Firestore 'users' update
    const userUpdateData: any = {};
    if (name) userUpdateData.name = name;
    if (email) userUpdateData.email = email;
    if (phone) userUpdateData.phone = phone;
    if (newRole) userUpdateData.role = newRole;
    if (address) userUpdateData.address = address;
    if (gender) userUpdateData.gender = gender;
    
    const userRef = firestoreAdmin.collection("users").doc(employeeId);
    await userRef.update(userUpdateData);

    // 3. Update salary record
    if (baseSalary !== undefined) {
        // <-- (BUG FIX) Use the secure `storeId` from auth, not `body.storeId`
        const salaryQuery = getStoreCollection(storeId, "salaries").where("userId", "==", employeeId).limit(1);
        const salarySnap = await salaryQuery.get();
        if (!salarySnap.empty) {
            const salaryDoc = salarySnap.docs[0];
            await salaryDoc.ref.update({
                baseSalary: Number(baseSalary) || 0,
                userName: name || body.userName, // Update name if it changed
                updatedAt: FieldValue.serverTimestamp()
            });
        }
    }

    return NextResponse.json({ success: true, id: employeeId });

  } catch (error: any) {
    console.error("[HR API PUT] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// 🗑️ DELETE - Remove Employee
// -----------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> } // <-- (BUILD FIX) Accept Promise
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  const params = await context.params; // <-- (BUILD FIX) Await params
  const employeeId = params.id; // <-- (BUILD FIX) Use resolved params

  if (!employeeId) {
    return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
  }

  try {
    const { storeId, role } = await getAuth(request);

    // --- Permission Check ---
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin or Manager role required." }, { status: 403 });
    }

    // Use a batch for atomic delete
    const batch = firestoreAdmin.batch();

    // 1. Delete from Auth
    await authAdmin.deleteUser(employeeId);

    // 2. Delete from Firestore 'users'
    const userRef = firestoreAdmin.collection("users").doc(employeeId);
    batch.delete(userRef);

    // 3. Delete from 'salaries'
    const salaryQuery = getStoreCollection(storeId, "salaries").where("userId", "==", employeeId).limit(1);
    const salarySnap = await salaryQuery.get();
    if (!salarySnap.empty) {
      batch.delete(salarySnap.docs[0].ref);
    }
    
    // 4. (Optional) Delete from other related collections like 'attendance', 'reviews' etc.
    // This part can be expanded or handled by a background cloud function.

    await batch.commit();

    return NextResponse.json({ success: true, id: employeeId });

  } catch (error: any) {
    console.error("[HR API DELETE] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}