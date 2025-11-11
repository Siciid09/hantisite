// File: app/api/hr/employees/[id]/route.ts
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Helper function
async function getAuth(request: NextRequest) {
  // ... (your existing function, no changes needed)
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
  context: { params: Promise<{ id: string }> } // <-- CHANGED
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  const { id: employeeId } = await context.params; // <-- CHANGED

  if (!employeeId) {
    return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
  }

  try {
    const { storeId, role } = await getAuth(request);

    // --- (MODIFIED) Permission Check ---
    if (role !== "admin" && role !== "hr" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin, HR, or Manager role required." }, { status: 403 });
    }
    
    const body = await request.json();
    const { name, email, phone, role: newRole, address, gender, baseSalary } = body;

    // 1. Prepare Auth update
    let authUpdates: any = {};
    if (name) authUpdates.displayName = name;
    if (email) authUpdates.email = email;
    
    if (Object.keys(authUpdates).length > 0) {
        await authAdmin.updateUser(employeeId, authUpdates);
    }
    if (newRole) {
      // Update custom claims
      await authAdmin.setCustomUserClaims(employeeId, { role: newRole, storeId: storeId });
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
        const salaryQuery = getStoreCollection(storeId, "salaries").where("userId", "==", employeeId).limit(1);
        const salarySnap = await salaryQuery.get();
        if (!salarySnap.empty) {
            const salaryDoc = salarySnap.docs[0];
            await salaryDoc.ref.update({
                baseSalary: Number(baseSalary) || 0,
                userName: name || body.userName, 
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
  context: { params: Promise<{ id: string }> } // <-- CHANGED
) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  const { id: employeeId } = await context.params; // <-- CHANGED

  if (!employeeId) {
    return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
  }

  try {
    const { storeId, role } = await getAuth(request);

    // --- (MODIFIED) Permission Check ---
    if (role !== "admin" && role !== "hr" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin, HR, or Manager role required." }, { status: 403 });
    }

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
    
    // We keep payrollHistory for records

    await batch.commit();

    return NextResponse.json({ success: true, id: employeeId });

  } catch (error: any) {
    console.error("[HR API DELETE] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}