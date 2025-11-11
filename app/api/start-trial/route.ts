// File: app/api/start-trial/route.ts
// Description: API endpoint to handle new free trial signups from the public homepage.
// It saves the trial request to a new 'trials' collection in Firestore.

import { NextResponse, NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { firestoreAdmin } from "@/lib/firebaseAdmin"; // Assuming this path is correct based on your other files

/**
 * @description Handles POST requests to create a new trial document in Firestore.
 * This is an unauthenticated endpoint intended for public use.
 */
export async function POST(request: NextRequest) {
  // Check if Firestore Admin is initialized
  if (!firestoreAdmin) {
    console.error("[Start Trial API] Firestore Admin SDK not configured.");
    return NextResponse.json({ error: "Admin SDK not configured." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, email, companyName, whatsapp, planType, planPrice } = body;

    // Validate required fields
    if (!name || !email || !companyName || !whatsapp || !planType || planPrice === undefined) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const now = Timestamp.now();

    // Data to be saved in the new 'trials' collection
    const trialData = {
      name,
      email,
      companyName,
      whatsapp,
      planType,
      planPrice: Number(planPrice), // Ensure price is a number
      createdAt: now,
      status: "pending", // To track who has been contacted
    };

    // Add the new document to the 'trials' collection
    const trialRef = await firestoreAdmin.collection("trials").add(trialData);

    // Return a success response with the new document ID
    return NextResponse.json({ success: true, id: trialRef.id }, { status: 201 });

  } catch (error: any) {
    console.error("[Start Trial API POST] Unhandled error:", error.stack || error.message);
    return NextResponse.json({ error: `Failed to create trial request. ${error.message}` }, { status: 500 });
  }
}