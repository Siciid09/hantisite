import { firestoreAdmin, messagingAdmin } from "@/lib/firebaseAdmin"; // Adjust path as needed
import dayjs from "dayjs";

// =============================================================================
// 🗣️ 1. MASTER MESSAGE TEMPLATES (Bilingual)
// =============================================================================
const TEMPLATES = {
  // --- SUBSCRIPTION MESSAGES ---
  sub_trial_warning: {
    title: "⏳ Trial Ending / Tijaabo Dhamaanaysa",
    body: "You have {days} days left. Subscribe to keep your data.\nWaxaa kuu hadhay {days} maalmood. Is-diiwaangeli."
  },
  sub_expired: {
    title: "❌ Service Halted / Adeegga Joogsaday",
    body: "Your subscription has expired. Please renew access.\nWakhtigii wuu ka dhacay. Fadlan cusbooneysii."
  },
  
  // --- INVENTORY MESSAGES ---
  inv_low_stock: {
    title: "📦 Low Stock Alert / Alaab Yaraatay",
    body: "{product} is running low ({qty} left). Restock soon!\n{product} wuu yaraaday ({qty} ayaa hadhay)."
  },

  // --- DAILY AI BRIEF MESSAGES ---
  // Note: These are simple strings, not objects with titles, based on your usage in runDailyBrief
  daily_growth: "🚀 Booming! Sales grew {val}% today.\n🚀 Korodh! Iibku wuxuu kordhay {val}% maanta.",
  daily_high_vol: "🔥 Busy day! {count} sales totaling {currency} {revenue}.",
  daily_debt_risk: "⚠️ High Debt Day. You gave {currency} {debt} in credit.",
  daily_normal: "✅ Daily Summary: {count} sales totaling {currency} {revenue}."
};

// =============================================================================
// 🧠 2. LOGIC FUNCTIONS
// =============================================================================

// --- A. HELPER: Send the actual message ---
async function sendFCM(token: string, title: string, body: string, type: string, data: any = {}) {
  try {
    await messagingAdmin.send({
      token: token,
      notification: { title, body },
      data: { 
        type: type, 
        click_action: "FLUTTER_NOTIFICATION_CLICK", // Standard for Flutter background clicks
        ...data 
      }
    });
    return true;
  } catch (e) {
    console.error("FCM Error:", e);
    return false;
  }
}

// --- B. CORE: Check Subscription (Run this Daily) ---
export async function runSubscriptionCheck() {
  const today = dayjs();
  const usersSnap = await firestoreAdmin.collection("users").get();
  let count = 0;

  for (const doc of usersSnap.docs) {
    const user = doc.data();
    if (!user.fcmToken || !user.subscriptionExpiry) continue;

    const expiry = dayjs(user.subscriptionExpiry.toDate());
    const daysLeft = expiry.diff(today, 'day');

    // Logic: Warn at 3 days, 1 day, or Expired
    if (daysLeft === 3 || daysLeft === 1 || (daysLeft <= 0 && daysLeft >= -2)) {
      const isExpired = daysLeft <= 0;
      const tmpl = isExpired ? TEMPLATES.sub_expired : TEMPLATES.sub_trial_warning;
      
      // FIX: Ensure we access .body before replacing
      const body = tmpl.body.replace("{days}", daysLeft.toString());
      
      await sendFCM(user.fcmToken, tmpl.title, body, "subscription_warning", {
        status: isExpired ? "expired" : "warning"
      });
      count++;
    }
  }
  return count;
}

// --- C. CORE: Generate Daily AI Brief (Run this Daily) ---
export async function runDailyBrief() {
  const today = dayjs();
  const start = today.startOf('day').toDate();
  const end = today.endOf('day').toDate();
  
  // Get yesterday for comparison
  const yStart = today.subtract(1, 'day').startOf('day').toDate();
  const yEnd = today.subtract(1, 'day').endOf('day').toDate();

  const usersSnap = await firestoreAdmin.collection("users").get();
  let count = 0;

  for (const doc of usersSnap.docs) {
    const user = doc.data();
    if (!user.fcmToken || !user.storeId) continue;

    // 1. Fetch Today's Data
    const salesSnap = await firestoreAdmin.collection("sales")
      .where("storeId", "==", user.storeId)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end).get();

    if (salesSnap.empty) continue; // No news is good news? Or maybe just silence.

    let revenue = 0;
    let debt = 0;
    salesSnap.forEach(s => {
      const d = s.data();
      revenue += (d.totalAmount || 0);
      debt += (d.debtAmount || 0);
    });

    // 2. Fetch Yesterday (For Growth Calc)
    const ySnap = await firestoreAdmin.collection("sales")
      .where("storeId", "==", user.storeId)
      .where("createdAt", ">=", yStart)
      .where("createdAt", "<=", yEnd).get();
    
    let yRevenue = 0;
    ySnap.forEach(s => yRevenue += (s.data().totalAmount || 0));

    // 3. AI Decision Logic
    let body = "";
    const growth = yRevenue > 0 ? ((revenue - yRevenue) / yRevenue) * 100 : 0;

    // Note: Since daily_growth/high_vol etc are just strings in the object above, we can replace directly.
    if (growth > 25) {
      body = TEMPLATES.daily_growth.replace("{val}", growth.toFixed(0));
    } else if (salesSnap.size > 20) {
      body = TEMPLATES.daily_high_vol
        .replace("{count}", salesSnap.size.toString())
        .replace("{currency}", "USD") // Replace with user currency if available
        .replace("{revenue}", revenue.toFixed(0));
    } else if (debt > (revenue * 0.5)) {
      body = TEMPLATES.daily_debt_risk
        .replace("{currency}", "USD")
        .replace("{debt}", debt.toFixed(0));
    } else {
      body = TEMPLATES.daily_normal
        .replace("{count}", salesSnap.size.toString())
        .replace("{currency}", "USD")
        .replace("{revenue}", revenue.toFixed(0));
    }

    await sendFCM(user.fcmToken, "📈 Daily Insight", body, "daily_summary");
    count++;
  }
  return count;
}

// --- D. CORE: Check Inventory (Call this INSTANTLY when sale happens) ---
export async function checkInventoryInstant(items: any[], uid: string) {
  // 1. Get User Token
  const userDoc = await firestoreAdmin.collection("users").doc(uid).get();
  const fcmToken = userDoc.data()?.fcmToken;
  if (!fcmToken) return;

  for (const item of items) {
    // 2. Check Database for REAL quantity
    const productRef = firestoreAdmin.collection("products").doc(item.productId);
    const productSnap = await productRef.get();
    
    if (productSnap.exists) {
      const pData = productSnap.data();
      const qty = pData?.quantity || 0;
      const threshold = pData?.lowStockThreshold || 5;

      // 3. Trigger Alert if Critical
      if (qty <= threshold) {
        
        // ======================================================
        // ✅ FIX APPLIED HERE
        // ======================================================
        // Old (Error): TEMPLATES.inv_low_stock.replace(...)
        // New (Fixed): TEMPLATES.inv_low_stock.body.replace(...)
        const body = TEMPLATES.inv_low_stock.body
          .replace(/{product}/g, pData?.name || "Item")
          .replace(/{qty}/g, qty.toString());

        await sendFCM(
          fcmToken, 
          TEMPLATES.inv_low_stock.title, 
          body, 
          "inventory_alert", 
          { productId: item.productId }
        );
      }
    }
  }
}