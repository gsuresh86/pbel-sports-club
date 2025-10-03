import { NextResponse } from 'next/server';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { app } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Note: This is a simplified approach for development
    // For production, you should use Firebase Admin SDK on the server side

    return NextResponse.json({
      message: 'Please use the signup page to create a user, then manually set role to admin in Firebase Console',
      instructions: [
        '1. Go to your app login page and sign up with your credentials',
        '2. Go to Firebase Console > Firestore Database',
        '3. Find your user in the "users" collection',
        '4. Edit the document and set the "role" field to "admin"',
      ]
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
