const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAqBiF0zMVHAmiWx70Ui4dDhHi2UAc6w_c",
  authDomain: "pbelcity-sports-club.firebaseapp.com",
  projectId: "pbelcity-sports-club",
  storageBucket: "pbelcity-sports-club.firebasestorage.app",
  messagingSenderId: "881793623489",
  appId: "1:881793623489:web:77d19cb15a14dc32427b40",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createCategorizedTournament() {
  try {
    const tournamentData = {
      name: "PBEL City Individual Championship",
      sport: "badminton",
      tournamentType: "individual",
      categories: ["girls-under-13", "boys-under-13", "girls-under-18", "boys-under-18", "mens-single", "womens-single", "mens-doubles", "mixed-doubles"],
      startDate: new Date("2024-02-15"),
      endDate: new Date("2024-02-15"),
      venue: "PBEL City Sports Complex",
      description: "Individual badminton championship for PBEL City residents. Available categories: Girls Under 13, Boys Under 13, Girls Under 18, Boys Under 18, Mens Single, Womens Single, Mens Doubles, and Mixed Doubles.",
      registrationDeadline: new Date("2024-02-10"),
      maxParticipants: 128,
      currentParticipants: 0,
      entryFee: 200,
      prizePool: 15000,
      rules: "Standard badminton rules apply. Each match is best of 3 sets. Registration closes 5 days before the tournament.",
      status: "upcoming",
      registrationOpen: true,
      publicRegistrationLink: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "admin"
    };

    const docRef = await addDoc(collection(db, 'tournaments'), tournamentData);
    
    // Update the document with the registration link
    const registrationLink = `http://localhost:3000/tournament/${docRef.id}/register`;
    await updateDoc(doc(db, 'tournaments', docRef.id), {
      publicRegistrationLink: registrationLink
    });

    console.log('Categorized tournament created successfully with ID:', docRef.id);
    console.log('Registration link:', registrationLink);
  } catch (error) {
    console.error('Error creating categorized tournament:', error);
  }
}

createCategorizedTournament();
