import { NextResponse } from 'next/server';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const { email, password, name, role, assignedTournaments, isActive } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    console.log('Creating Firebase Auth user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Firebase Auth user created:', userCredential.user.uid);
    
    // Prepare user data
    const userData = {
      name: name.trim(),
      email: email.trim(),
      role,
      assignedTournaments: assignedTournaments || [],
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Creating Firestore user document...');
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), userData);
    console.log('Firestore user document created successfully');

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: userCredential.user.uid,
      userData: {
        id: userCredential.user.uid,
        ...userData
      }
    });

  } catch (error: unknown) {
    console.error('Error creating user:', error);
    
    let errorMessage = 'Failed to create user';
    if (error && typeof error === 'object' && 'code' in error) {
      const firebaseError = error as { code: string; message: string };
      
      if (firebaseError.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use';
      } else if (firebaseError.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else {
        errorMessage = firebaseError.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
