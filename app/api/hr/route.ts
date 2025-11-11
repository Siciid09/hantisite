// File: app/api/hr/route.ts
// Description: API route for listing employees (GET) and adding new employees (POST).
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

  return { storeId, uid, userName: userData.name || "System", role };
}

// Helper to get store-specific sub-collection
function getStoreCollection(storeId: string, collectionName: string) {
    return firestoreAdmin.collection("stores").doc(storeId).collection(collectionName);
}

// -----------------------------------------------------------------------------
// 📋 GET - List Employees or Payroll Data
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId, role } = await getAuth(request);
    
    // --- (MODIFIED) Permission Check ---
    if (role !== "admin" && role !== "hr" && role !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin, HR, or Manager role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "employees";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;

    let data: any = {};
    let pagination = { currentPage: page, hasMore: false };

    if (view === "employees") {
      const usersQuery = firestoreAdmin.collection("users")
        .where("storeId", "==", storeId)
        .limit(limit + 1) // Fetch one extra to check for 'hasMore'
        .offset((page - 1) * limit);
        
      const usersSnap = await usersQuery.get();
      const employeeData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      pagination.hasMore = employeeData.length > limit;
      if (pagination.hasMore) {
        employeeData.pop(); // Remove the extra one
      }
      data = employeeData;

    } else if (view === "payroll") {
      const salariesQuery = getStoreCollection(storeId, "salaries");
      const salariesSnap = await salariesQuery.get();
      const salariesData = salariesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const historyQuery = getStoreCollection(storeId, "payrollHistory")
        .orderBy("payDate", "desc")
        .limit(limit + 1)
        .offset((page - 1) * limit);
      
      const historySnap = await historyQuery.get();
      const historyData = historySnap.docs.map(doc => {
          const docData = doc.data();
          return {
              ...docData,
              id: doc.id,
              payDate: (docData.payDate as Timestamp).toDate().toISOString(),
              processedAt: (docData.processedAt as Timestamp).toDate().toISOString(),
          };
      });

      pagination.hasMore = historyData.length > limit;
      if (pagination.hasMore) {
        historyData.pop(); // Remove extra
      }

      data = {
        salaries: salariesData,
        history: historyData,
      };
    }

    return NextResponse.json({
      success: true,
      data: data,
      pagination: pagination,
    });

  } catch (error: any) {
    console.error("[HR API GET] Error:", error.stack || error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// ➕ POST - Add New Employee
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId, role: adminRole } = await getAuth(request);

    // --- (MODIFIED) Permission Check ---
    if (adminRole !== "admin" && adminRole !== "hr" && adminRole !== "manager") {
      return NextResponse.json({ error: "Permission Denied: Admin, HR, or Manager role required." }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, phone, role, address, gender, baseSalary } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Name, Email, and Role are required." }, { status: 400 });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await authAdmin.createUser({
      email: email,
      emailVerified: true,
      password: password || "password123", // Set a default password
      displayName: name,
      disabled: false,
    });
    const uid = userRecord.uid;

    // 2. Set custom claims (like role)
    await authAdmin.setCustomUserClaims(uid, { role: role, storeId: storeId });

    // 3. Save user data to 'users' collection in Firestore
    const userDoc = {
      uid: uid,
      name: name,
      email: email,
      phone: phone || "",
      address: address || "",
      gender: gender || "male",
      role: role,
      storeId: storeId,
      createdAt: FieldValue.serverTimestamp(),
    };
    await firestoreAdmin.collection("users").doc(uid).set(userDoc);

    // 4. Create their salary record
    const salaryDoc = {
      userId: uid,
      userName: name,
      baseSalary: Number(baseSalary) || 0,
      frequency: "monthly", // Default
      storeId: storeId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await getStoreCollection(storeId, "salaries").add(salaryDoc);
    
    return NextResponse.json({ success: true, id: uid, ...userDoc }, { status: 201 });

  } catch (error: any) {
    console.error("[HR API POST] Error:", error.stack || error.message);
    if (error.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: "Email already in use." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}