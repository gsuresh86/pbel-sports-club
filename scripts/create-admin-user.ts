// Script to create the first admin user in Firestore
// Run this with: npx ts-node scripts/create-admin-user.ts

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAqBiF0zMVHAmiWx70Ui4dDhHi2UAc6w_c",
  authDomain: "pbelcity-sports-club.firebaseapp.com",
  projectId: "pbelcity-sports-club",
  storageBucket: "pbelcity-sports-club.firebasestorage.app",
  messagingSenderId: "881793623489",
  appId: "1:881793623489:web:77d19cb15a14dc32427b40",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdminUser() {
  try {
    // Change these credentials as needed
    const email = 'admin@pbelcity.com';
    const password = 'Admin@123456';
    const name = 'Admin User';

    console.log('Creating admin user...');

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('User created in Auth:', user.uid);

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      name: name,
      role: 'admin',
      createdAt: new Date(),
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: admin');
    console.log('\nYou can now login with these credentials.');

    process.exit(0);
  } catch (error: any) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
