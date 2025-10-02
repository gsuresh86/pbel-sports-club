// Script to create a test tournament with open registration
// Run this with: npx ts-node scripts/create-test-tournament.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAqBiF0zMVHAmiWx70Ui4dDhHi2UAc6w_c",
  authDomain: "pbelcity-sports-club.firebaseapp.com",
  projectId: "pbelcity-sports-club",
  storageBucket: "pbelcity-sports-club.firebasestorage.app",
  messagingSenderId: "881793623489",
  appId: "1:881793623489:web:77d19cb15a14dc32427b40",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createTestTournament() {
  try {
    console.log('Creating test tournament...');

    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const registrationDeadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    const tournamentData = {
      name: 'Test Badminton Tournament',
      sport: 'badminton',
      startDate: startDate,
      endDate: endDate,
      venue: 'PBEL Sports Complex',
      description: 'A test tournament to verify the registration system is working correctly.',
      registrationDeadline: registrationDeadline,
      maxParticipants: 32,
      currentParticipants: 0,
      entryFee: 100,
      prizePool: 5000,
      rules: 'Standard badminton rules apply. Best of 3 sets, 21 points per set.',
      status: 'upcoming',
      registrationOpen: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
    };

    const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
    
    // Generate registration link
    const registrationLink = `http://localhost:3000/tournament/${docRef.id}/register`;
    
    // Update with registration link
    await addDoc(collection(db, 'tournaments'), {
      ...tournamentData,
      id: docRef.id,
      publicRegistrationLink: registrationLink,
    });

    console.log('✅ Test tournament created successfully!');
    console.log('Tournament ID:', docRef.id);
    console.log('Registration Link:', registrationLink);
    console.log('Start Date:', startDate.toLocaleDateString());
    console.log('End Date:', endDate.toLocaleDateString());
    console.log('Registration Deadline:', registrationDeadline.toLocaleDateString());
    console.log('Max Participants:', 32);
    console.log('Entry Fee: ₹100');
    console.log('Prize Pool: ₹5000');

    process.exit(0);
  } catch (error: any) {
    console.error('Error creating test tournament:', error.message);
    process.exit(1);
  }
}

createTestTournament();
