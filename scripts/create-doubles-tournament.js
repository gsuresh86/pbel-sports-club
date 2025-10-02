// Script to create a doubles tournament
// Run this with: node scripts/create-doubles-tournament.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

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

async function createDoublesTournament() {
  try {
    console.log('Creating doubles tournament...');

    const now = new Date();
    const startDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const endDate = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000); // 12 days from now
    const registrationDeadline = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days from now

    const tournamentData = {
      name: 'PBEL City Doubles Badminton Championship',
      sport: 'badminton',
      startDate: startDate,
      endDate: endDate,
      venue: 'PBEL Sports Complex - Court 1 & 2',
      description: 'Community doubles badminton tournament for PBEL City residents. Perfect for partners to showcase their teamwork and skills.',
      registrationDeadline: registrationDeadline,
      maxParticipants: 16, // 8 teams
      currentParticipants: 0,
      entryFee: 200, // Per team
      prizePool: 8000,
      rules: `Doubles Badminton Tournament Rules:
1. Teams must consist of 2 players
2. Best of 3 sets, 21 points per set
3. Standard badminton rules apply
4. Teams must be from PBEL City
5. Mixed doubles allowed
6. Tournament format: Knockout with consolation matches`,
      status: 'upcoming',
      registrationOpen: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
    };

    const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
    
    // Generate registration link
    const registrationLink = `http://localhost:3001/tournament/${docRef.id}/register`;
    
    console.log('✅ Doubles tournament created successfully!');
    console.log('Tournament ID:', docRef.id);
    console.log('Registration Link:', registrationLink);
    console.log('Start Date:', startDate.toLocaleDateString());
    console.log('End Date:', endDate.toLocaleDateString());
    console.log('Registration Deadline:', registrationDeadline.toLocaleDateString());
    console.log('Max Teams:', 8);
    console.log('Entry Fee: ₹200 per team');
    console.log('Prize Pool: ₹8000');

    process.exit(0);
  } catch (error) {
    console.error('Error creating doubles tournament:', error.message);
    process.exit(1);
  }
}

createDoublesTournament();
