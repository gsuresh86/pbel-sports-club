export type UserRole = 'admin' | 'public' | 'tournament-admin' | 'super-admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  assignedTournaments?: string[]; // Array of tournament IDs this user can manage
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string; // ID of the admin who created this user
  isActive?: boolean;
  fcmToken?: string;
  fcmTokenUpdatedAt?: Date;
}

export interface Notification {
  id: string;
  userId: string; // User who should receive this notification
  title: string;
  body: string;
  type: 'tournament' | 'registration' | 'system' | 'other';
  read: boolean;
  data?: {
    tournamentId?: string;
    registrationId?: string;
    [key: string]: string | undefined;
  };
  createdAt: Date;
  readAt?: Date;
}

export type SportType = 'badminton' | 'table-tennis' | 'volleyball' | 'throw-ball';
export type TournamentType = 'individual' | 'team';
export type CategoryType = 'girls-under-13' | 'boys-under-13' | 'girls-under-18' | 'boys-under-18' | 'mens-single' | 'womens-single' | 'mens-doubles' | 'mixed-doubles' | 'mens-team' | 'womens-team' | 'kids-team-u13' | 'kids-team-u18' | 'open-team';

export interface Tournament {
  id: string;
  name: string;
  sport: SportType;
  tournamentType: TournamentType;
  categories: CategoryType[];
  startDate: Date;
  endDate: Date;
  venue: string;
  description: string;
  registrationDeadline: Date;
  maxParticipants: number;
  currentParticipants: number;
  entryFee?: number;
  prizePool?: number;
  rules: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registrationOpen: boolean;
  isPublic?: boolean; // Tournament visibility for public page
  banner?: string; // URL to the uploaded banner image
  /** Match format: single set (1 set wins) or best of 3 (first to 2 sets) */
  matchFormat?: 'single-set' | 'best-of-3';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Registration {
  id: string;
  tournamentId: string;
  // Primary player details
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  tower: string; // A to P (except O, I)
  flatNumber: string;
  emergencyContact: string;
  // Partner details for doubles games
  partnerName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  partnerTower?: string;
  partnerFlatNumber?: string;
  // Expertise level
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  previousExperience?: string;
  // Additional community details
  isResident: boolean;
  selectedCategory: CategoryType;
  // Payment details
  paymentReference?: string;
  paymentAmount?: number;
  paymentMethod?: 'qr_code' | 'cash' | 'bank_transfer';
  paymentVerifiedAt?: Date;
  paymentVerifiedBy?: string;
  // Registration status
  registrationStatus: 'pending' | 'approved' | 'rejected';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  registrationCode: string;
  registeredAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface Player {
  id: string;
  tournamentId: string;
  registrationId: string; // Reference to the original registration
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  tower: string;
  flatNumber: string;
  emergencyContact: string;
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  previousExperience?: string;
  isResident: boolean;
  selectedCategory: CategoryType;
  // Player status
  status: 'active' | 'eliminated' | 'withdrawn';
  seed?: number;
  // Partner information (for doubles)
  partnerId?: string; // Reference to partner player
  partnerName?: string;
  // Payment status
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentReference?: string;
  paymentAmount?: number;
  paymentMethod?: 'qr_code' | 'cash' | 'bank_transfer';
  paymentVerifiedAt?: Date;
  paymentVerifiedBy?: string;
  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: string;
  matchNumber: number;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  player1Score?: number;
  player2Score?: number;
  sets: MatchSet[];
  scheduledTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  venue: string;
  court?: string;
  referee?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed';
  winner?: string;
  notes?: string;
  /** Override tournament default: single set (1 set wins) or best of 3 (first to 2 sets) */
  matchFormat?: 'single-set' | 'best-of-3';
  updatedAt: Date;
  createdBy: string;
}

export interface MatchSet {
  setNumber: number;
  player1Score: number;
  player2Score: number;
  duration?: number; // in minutes
}

export interface Winner {
  id: string;
  tournamentId: string;
  position: 1 | 2 | 3;
  participantId: string;
  participantName: string;
  prize?: string;
  createdAt: Date;
}

export interface LiveScore {
  matchId: string;
  tournamentId: string;
  currentSet: number;
  player1Sets: number;
  player2Sets: number;
  player1CurrentScore: number;
  player2CurrentScore: number;
  player1Name: string;
  player2Name: string;
  isLive: boolean;
  lastUpdated: Date;
  updatedBy: string;
}

export interface TournamentBracket {
  id: string;
  tournamentId: string;
  category: CategoryType;
  rounds: BracketRound[];
  participants: BracketParticipant[];
  status: 'pending' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string; // e.g., "Round of 16", "Quarterfinals", "Semifinals", "Final"
  matches: BracketMatch[];
  isCompleted: boolean;
}

export interface BracketMatch {
  id: string;
  matchNumber: number;
  player1Id?: string;
  player2Id?: string;
  player1Name?: string;
  player2Name?: string;
  player1Seed?: number;
  player2Seed?: number;
  winnerId?: string;
  winnerName?: string;
  status: 'pending' | 'ready' | 'live' | 'completed';
  scheduledTime?: Date;
  venue?: string;
  court?: string;
  score?: {
    player1Sets: number;
    player2Sets: number;
    sets: MatchSet[];
  };
}

export interface BracketParticipant {
  id: string;
  name: string;
  seed?: number;
  isEliminated: boolean;
  eliminatedInRound?: number;
  finalPosition?: number;
}

export interface RegistrationForm {
  id: string;
  tournamentId: string;
  fields: FormField[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea' | 'date';
  label: string;
  required: boolean;
  options?: string[]; // For select fields
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  category: CategoryType;
  players: string[]; // Array of player IDs
  captainId?: string; // ID of team captain
  poolId?: string; // ID of pool/group this team belongs to
  seed?: number; // Seeding for tournament
  status: 'active' | 'eliminated' | 'withdrawn';
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

export interface Pool {
  id: string;
  tournamentId: string;
  name: string;
  category: CategoryType;
  teams: string[]; // Array of team IDs
  maxTeams: number;
  status: 'pending' | 'active' | 'completed';
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
}

export interface TeamAssignment {
  id: string;
  tournamentId: string;
  playerId: string;
  teamId?: string;
  assignedAt?: Date;
  assignedBy?: string;
  status: 'unassigned' | 'assigned' | 'pending';
}
