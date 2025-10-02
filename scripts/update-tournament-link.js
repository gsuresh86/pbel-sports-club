// Script to update tournament with correct registration link
// Run this with: node scripts/update-tournament-link.js

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');

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

async function updateTournamentLink() {
  try {
    const tournamentId = 'sbqeV18Hm6GmclQJ7Cpg';
    const registrationLink = `http://localhost:3001/tournament/${tournamentId}/register`;
    
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      publicRegistrationLink: registrationLink
    });
    
    console.log('✅ Tournament updated with registration link!');
    console.log('Tournament ID:', tournamentId);
    console.log('Registration Link:', registrationLink);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating tournament:', error.message);
    process.exit(1);
  }
}

updateTournamentLink();
