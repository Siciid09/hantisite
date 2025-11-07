import { NextResponse } from 'next/server';
// We no longer import 'cookies' here, we'll use the response object
import { authAdmin } from '@/lib/firebaseAdmin'; // <-- FIX 1: Import authAdmin

/**
 * @description Creates a session cookie on login
 */
export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    // Verify the ID token and create a session cookie.
    const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

    // --- FIX 2: Set cookie on the response ---
    const response = NextResponse.json({ status: 'success' }, { status: 200 });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn,
      path: '/',
    });

    return response;
    // ------------------------------------------

  } catch (error) {
    console.error('Session Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * @description Clears the session cookie on logout
 */
export async function DELETE() {
  try {
    // --- FIX 2: Clear cookie on the response ---
    const response = NextResponse.json({ status: 'success' }, { status: 200 });
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
    // ------------------------------------------

  } catch (error) {
    console.error('Session Logout Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}