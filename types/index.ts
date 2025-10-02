export type UserRole = 'admin' | 'public';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export type SportType = 'badminton' | 'table-tennis' | 'volleyball';
export type TournamentType = 'individual' | 'team';
export type CategoryType = 'girls-under-13' | 'boys-under-13' | 'girls-under-18' | 'boys-under-18' | 'mens-single' | 'womens-single' | 'mens-doubles' | 'mixed-doubles' | 'mens-team' | 'womens-team' | 'kids-team-u13' | 'kids-team-u18';

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
  publicRegistrationLink: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Participant {
  id: string;
  tournamentId: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  tower: string; // A to P (except O, I)
  flatNumber: string;
  emergencyContact: string;
  registrationStatus: 'pending' | 'approved' | 'rejected';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  registrationCode: string;
  registeredAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
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
  round: string;
  matches: string[]; // Match IDs
  participants: string[]; // Participant IDs
  createdAt: Date;
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
