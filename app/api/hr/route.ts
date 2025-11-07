// File: app/api/hr/route.ts
// Description: API route for HR module. (EXPANDED)
// -----------------------------------------------------------------------------

import { NextResponse, NextRequest } from "next/server";
import { firestoreAdmin, authAdmin } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import dayjs from "dayjs";

// Helper function (NO CHANGE)
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
// 📊 GET - Fetch Data for ALL HR Tabs (FULLY EXPANDED)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  if (!authAdmin || !firestoreAdmin) {
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const { storeId } = await getAuth(request, true); // Admin required
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "overview"; // Default to overview
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 10;
    const offset = (page - 1) * limit;

    let data;
    let pagination = { currentPage: page, hasMore: false };

    switch (view) {
        // -------------------------------------------------
        // ✅ 1. OVERVIEW (NEW)
        // -------------------------------------------------
        case "overview":
            const usersRef = firestoreAdmin.collection("users").where("storeId", "==", storeId);
            const attendanceRef = getStoreCollection(storeId, "attendance");
            const leavesRef = getStoreCollection(storeId, "leaves");

            // Get today's attendance
            const today = dayjs().startOf('day').toDate();
            const tomorrow = dayjs().endOf('day').toDate();

            const [
                totalEmployeesSnap,
                activeTodaySnap,
                onLeaveSnap,
                newHiresSnap
            ] = await Promise.all([
                usersRef.count().get(),
                attendanceRef
                    .where('checkIn', '>=', today)
                    .where('checkIn', '<=', tomorrow)
                    .count().get(),
                leavesRef
                    .where('startDate', '<=', today)
                    .where('endDate', '>=', today)
                    .where('status', '==', 'Approved')
                    .count().get(),
                usersRef
                    .where('createdAt', '>=', dayjs().startOf('month').toDate())
                    .count().get()
            ]);

            data = {
                totalEmployees: totalEmployeesSnap.data().count,
                activeToday: activeTodaySnap.data().count,
                onLeave: onLeaveSnap.data().count,
                newHiresThisMonth: newHiresSnap.data().count,
            };
            break;

        // -------------------------------------------------
        // 2. EMPLOYEES (Original)
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
        // ✅ 3. DEPARTMENTS (NEW)
        // -------------------------------------------------
        case "departments":
            const deptQuery = getStoreCollection(storeId, "departments").orderBy("name");
            const deptSnapshot = await deptQuery.get();
            data = deptSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // No pagination needed for departments
            break;
          
        // -------------------------------------------------
        // 4. ATTENDANCE (Original)
        // -------------------------------------------------
        case "attendance":
            const attQuery = getStoreCollection(storeId, "attendance")
              .orderBy("checkIn", "desc")
              .limit(limit)
              .offset(offset);
            const attSnapshot = await attQuery.get();
            data = attSnapshot.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data(),
              checkIn: (doc.data().checkIn as Timestamp)?.toDate().toISOString() || null,
              checkOut: (doc.data().checkOut as Timestamp)?.toDate().toISOString() || null,
            }));
            pagination.hasMore = data.length === limit;
            break;

        // -------------------------------------------------
        // ✅ 5. LEAVES (NEW)
        // -------------------------------------------------
        case "leaves":
            const leavesQuery = getStoreCollection(storeId, "leaves")
                .orderBy("startDate", "desc")
                .limit(limit)
                .offset(offset);
            const leavesSnapshot = await leavesQuery.get();
            data = leavesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                startDate: (doc.data().startDate as Timestamp)?.toDate().toISOString() || null,
                endDate: (doc.data().endDate as Timestamp)?.toDate().toISOString() || null,
            }));
            pagination.hasMore = data.length === limit;
            break;

        // -------------------------------------------------
        // 6. PAYROLL (Original)
        // -------------------------------------------------
        case "payroll":
            const payrollQuery = getStoreCollection(storeId, "salaries")
                .orderBy("userName")
              .limit(limit)
              .offset(offset);
            const payrollSnapshot = await payrollQuery.get();
            data = payrollSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            pagination.hasMore = data.length === limit;
            break;
            
        // -------------------------------------------------
        // 7. PERFORMANCE (Original)
        // -------------------------------------------------
        case "performance":
            const perfQuery = getStoreCollection(storeId, "reviews")
              .orderBy("reviewDate", "desc")
              .limit(limit)
              .offset(offset);
            const perfSnapshot = await perfQuery.get();
            data = perfSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              reviewDate: (doc.data().reviewDate as Timestamp)?.toDate().toISOString() || null,
            }));
            pagination.hasMore = data.length === limit;
            break;

        // -------------------------------------------------
        // ✅ 8. RECRUITMENT (NEW)
        // -------------------------------------------------
        case "recruitment":
            const jobsQuery = getStoreCollection(storeId, "jobPostings")
                .orderBy("createdAt", "desc")
                .limit(limit)
                .offset(offset);
            const jobsSnapshot = await jobsQuery.get();
            data = jobsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: (doc.data().createdAt as Timestamp)?.toDate().toISOString() || null,
            }));
            pagination.hasMore = data.length === limit;
            break;

        // -------------------------------------------------
        // ✅ 9. DOCUMENTS (NEW)
        // -------------------------------------------------
        case "documents":
            const docsQuery = getStoreCollection(storeId, "hrDocuments")
                .orderBy("uploadedAt", "desc")
                .limit(limit)
                .offset(offset);
            const docsSnapshot = await docsQuery.get();
            data = docsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                uploadedAt: (doc.data().uploadedAt as Timestamp)?.toDate().toISOString() || null,
            }));
            pagination.hasMore = data.length === limit;
            break;

        // -------------------------------------------------
        // ✅ 10. SETTINGS (NEW)
        // -------------------------------------------------
        case "settings":
            const settingsDoc = await getStoreCollection(storeId, "settings").doc("hr").get();
            if (settingsDoc.exists) {
                data = settingsDoc.data();
            } else {
                // Default settings
                data = {
                    workingHours: { start: "08:00", end: "17:00" },
                    leaveTypes: ["Annual", "Sick", "Unpaid"],
                    payrollRules: { taxPercentage: 0.15 }
                };
            }
            break;

        // -------------------------------------------------
        // ROLES (Kept for Add/Edit Modals)
        // -------------------------------------------------
        case "roles":
            const rolesQuery = firestoreAdmin.collection("roles").orderBy("level");
            const rolesSnapshot = await rolesQuery.get();
            data = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            break;
          
        default:
            return NextResponse.json({ error: "Invalid view type." }, { status: 400 });
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
        const { name, email, phone, role, departmentId, baseSalary } = body;
        if (!name || !email || !role || !departmentId) {
            return NextResponse.json({ error: "Name, Email, Role, and Department are required." }, { status: 400 });
        }

        // 2. Create user in Firebase Auth
        const userRecord = await authAdmin.createUser({
          email: email,
          password: body.password || 'password123', // Set temporary password
          displayName: name,
          disabled: false,
        });

        // 3. Add user to Firestore 'users' collection
        const newUser = {
          name: name,
          email: email,
          phone: phone,
          role: role,
          departmentId: departmentId, // ✅ Added
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

        // 5. Send password reset email
        const resetLink = await authAdmin.generatePasswordResetLink(email);
        console.log(`Password reset link for ${email}: ${resetLink}`);

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