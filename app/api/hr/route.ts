// File: app/api/hr/route.ts
// Description: API route for HR module. (MODIFIED)
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";

// Helper function (MODIFIED - to not require admin by default)
async function getAuth(request: NextRequest, adminRequired = false) {
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
  if (adminRequired && role !== "admin") {
    throw new Error("Permission Denied: Admin role required.");
  }

  return { storeId, uid, userName: userData.name || "System", role };
}

// Helper to get store-specific sub-collection
function getStoreCollection(storeId: string, collectionName: string) {
    return firestoreAdmin.collection("stores").doc(storeId).collection(collectionName);
}

// -----------------------------------------------------------------------------
// 📊 GET - Fetch Data for HR Tabs (MODIFIED)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await getAuth(request, true); // Admin required to view page
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "employees";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;
    const offset = (page - 1) * limit;

    let data;
    let pagination = { currentPage: page, hasMore: false };

    switch (view) {
        // -------------------------------------------------
        // 1. EMPLOYEES
        // -------------------------------------------------
        case "employees":
            const empQuery = firestoreAdmin
              .collection("users")
              .where("storeId", "==", storeId)
              .orderBy("name")
              .limit(limit)
              .offset(offset);
            const empSnapshot = await empQuery.get();
            data = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            pagination.hasMore = data.length === limit;
            break;
        
        // -------------------------------------------------
        // 2. ROLES & PERMISSIONS (REMOVED)
        // -------------------------------------------------
        
        // -------------------------------------------------
        // 3. ATTENDANCE (REMOVED)
        // -------------------------------------------------

        // -------------------------------------------------
        // 4. PAYROLL (MODIFIED)
        // -------------------------------------------------
        case "payroll":
            // Fetch both salaries and payroll history
            const payrollQuery = getStoreCollection(storeId, "salaries")
                .orderBy("userName")
                .limit(limit)
                .offset(offset);
            
            const historyQuery = getStoreCollection(storeId, "payrollHistory")
                .orderBy("payDate", "desc")
                .limit(limit)
                .offset(offset);

            const [payrollSnapshot, historySnapshot] = await Promise.all([
                payrollQuery.get(),
                historyQuery.get()
            ]);

            const salaryData = payrollSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const historyData = historySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                payDate: (doc.data().payDate as Timestamp)?.toDate().toISOString() || null,
                processedAt: (doc.data().processedAt as Timestamp)?.toDate().toISOString() || null,
            }));
            
            // Note: Pagination is tricky for two lists. We'll paginate both.
            // A better solution might be separate API calls.
            data = {
                salaries: salaryData,
                history: historyData,
            };
            
            pagination.hasMore = salaryData.length === limit || historyData.length === limit;
            break;
            
        // -------------------------------------------------
        // 5. PERFORMANCE (REMOVED)
        // -------------------------------------------------

        default:
            // Default to employees if view is invalid
            const defaultQuery = firestoreAdmin
              .collection("users")
              .where("storeId", "==", storeId)
              .orderBy("name")
              .limit(limit)
              .offset(offset);
            const defaultSnapshot = await defaultQuery.get();
            data = defaultSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            pagination.hasMore = data.length === limit;
            break;
    }

    return NextResponse.json({ data, pagination });

  } catch (error: any) {
      console.error("[HR API GET] Error:", error.stack || error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ➕ POST - Create New Employee (UPDATED)
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await getAuth(request, true); // Only admin can add users
    const body = await request.json();

    // 1. Validate required fields
    // Added address, gender, password
    const { name, email, phone, role, baseSalary, password, address, gender } = body;
    if (!name || !email || !role) {
        return NextResponse.json({ error: "Name, Email, and Role are required." }, { status: 400 });
    }

    // 2. Create user in Firebase Auth
    const userRecord = await authAdmin.createUser({
      email: email,
      password: password || 'password123', // Use provided password or default
      displayName: name,
      disabled: false,
    });

    // 3. Add user to Firestore 'users' collection
    // Added address and gender
    const newUser = {
      name: name,
      email: email,
      phone: phone || "",
      role: role,
      address: address || "", // Added
      gender: gender || "",   // Added
      status: "approved",
      storeId: storeId,
      createdAt: Timestamp.now(),
    };
    
    // 4. Add salary record
    const newSalary = {
        userId: userRecord.uid,
        userName: name,
        baseSalary: Number(baseSalary) || 0,
        frequency: "Monthly", // Default
        bonuses: 0,
        deductions: 0,
        updatedAt: Timestamp.now(),
    };

    // Use a batch to write user and salary
    const batch = firestoreAdmin.batch();
    const userRef = firestoreAdmin.collection("users").doc(userRecord.uid);
    batch.set(userRef, newUser);

    const salaryRef = getStoreCollection(storeId, "salaries").doc(); // Auto-ID
    batch.set(salaryRef, newSalary);
    
    await batch.commit();

    // 5. Send password reset email (if default password was used)
    if (!password) {
        const resetLink = await authAdmin.generatePasswordResetLink(email);
        console.log(`Password reset link for ${email}: ${resetLink}`);
    }

    return NextResponse.json({ success: true, id: userRecord.uid, ...newUser }, { status: 201 });

  } catch (error: any) {
    console.error("[HR API POST] Error:", error.stack || error.message);
    // If auth user was created but firestore failed, delete the auth user
    if (error.code === 'auth/email-already-exists' && (error as any).uid) {
         await authAdmin.deleteUser((error as any).uid);
         console.log(`Cleaned up orphaned auth user: ${(error as any).uid}`);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}