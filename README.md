# PBEL City Sports Association Web App

A comprehensive sports tournament management system built with Next.js 15, Firebase, and Tailwind CSS for managing badminton, table tennis, and volleyball tournaments in PBEL City.

## Features

### Public Features
- **Home Page**: Overview of sports categories and quick links
- **Tournament Listings**: Browse all tournaments by sport
- **Registration Form**: Register for tournaments with personal details
- **Match Schedules**: View upcoming matches and fixtures
- **Live Scores**: Real-time score updates for ongoing matches
- **Winners Gallery**: Hall of fame showcasing tournament champions

### Admin Features
- **Tournament Management**: Create, edit, and delete tournaments
- **Match Scheduling**: Schedule matches and manage fixtures
- **Live Score Updates**: Update scores in real-time during matches
- **Participant Management**: View and manage registered participants
- **Winner Announcements**: Declare tournament winners and prizes
- **Authentication**: Secure admin access with role-based permissions

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
   - The `.env.local` file is already set up with your Firebase credentials
   - Firebase config is located in `lib/firebase.ts`

3. Set up Firebase Firestore Collections:
   Create the following collections in your Firebase project:
   - `users` - User accounts with roles
   - `tournaments` - Tournament data
   - `participants` - Registration data
   - `matches` - Match schedules and results
   - `liveScores` - Real-time score updates
   - `winners` - Tournament winners

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
pbel-sports-club/
├── app/
│   ├── admin/              # Admin dashboard pages
│   │   ├── tournaments/    # Manage tournaments
│   │   └── live-scores/    # Update live scores
│   ├── login/              # Authentication page
│   ├── register/           # Tournament registration
│   ├── schedules/          # Match schedules
│   ├── live-scores/        # Public live scores
│   ├── winners/            # Winners display
│   └── page.tsx            # Home page
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── Navbar.tsx          # Navigation component
├── contexts/
│   └── AuthContext.tsx     # Authentication context
├── lib/
│   ├── firebase.ts         # Firebase configuration
│   └── utils.ts            # Utility functions
└── types/
    └── index.ts            # TypeScript type definitions
```

## Firebase Security Rules

Make sure to set up appropriate security rules in Firebase:

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Public can read tournaments, matches, winners
    match /tournaments/{document=**} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /matches/{document=**} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /winners/{document=**} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /liveScores/{document=**} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Participants
    match /participants/{document=**} {
      allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow create: if true;
    }
  }
}
```

## Creating the First Admin User

To create the first admin user, you'll need to:

1. Sign up through the app or Firebase Console
2. Manually update the user's role in Firestore:
   - Go to Firebase Console > Firestore
   - Find the user document in the `users` collection
   - Set the `role` field to `'admin'`

## Available Sports

- 🏸 Badminton
- 🏓 Table Tennis
- 🏐 Volleyball

## Contributing

This is a community project for PBEL City. Feel free to contribute!

## License

MIT
