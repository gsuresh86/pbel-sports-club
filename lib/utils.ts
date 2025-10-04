import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a public registration link for a tournament
 * Uses environment variable for base URL, falls back to current origin
 */
export function generateRegistrationLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}/register`;
}

/**
 * Generate a public tournament view link
 */
export function generateTournamentLink(tournamentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${baseUrl}/tournament/${tournamentId}`;
}

/**
 * Clean data for Firebase by removing undefined values and converting empty strings to null
 */
function cleanFirebaseData(data: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      // Convert empty strings to null for optional fields
      if (typeof value === 'string' && value.trim() === '') {
        cleaned[key] = null;
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Create players from a registration
 * Handles both single and doubles registrations
 */
export async function createPlayersFromRegistration(
  registration: any,
  tournamentId: string,
  registrationId: string,
  db: any
): Promise<string[]> {
  console.log('createPlayersFromRegistration called with:', { tournamentId, registrationId, registration });
  const playerIds: string[] = [];
  
  // Create primary player - filter out undefined values
  const primaryPlayerData = cleanFirebaseData({
    tournamentId,
    registrationId,
    name: registration.name,
    email: registration.email,
    phone: registration.phone,
    age: registration.age,
    gender: registration.gender,
    tower: registration.tower,
    flatNumber: registration.flatNumber,
    emergencyContact: registration.emergencyContact,
    expertiseLevel: registration.expertiseLevel,
    previousExperience: registration.previousExperience,
    isResident: registration.isResident,
    selectedCategory: registration.selectedCategory,
    status: 'active' as const,
    paymentStatus: registration.paymentStatus,
    paymentReference: registration.paymentReference,
    paymentAmount: registration.paymentAmount,
    paymentMethod: registration.paymentMethod,
    paymentVerifiedAt: registration.paymentVerifiedAt,
    paymentVerifiedBy: registration.paymentVerifiedBy,
    createdAt: new Date(),
  });

  console.log('Creating primary player with data:', primaryPlayerData);

  // Use client-side Firebase SDK
  const { addDoc, collection, updateDoc, doc } = await import('firebase/firestore');
  const primaryPlayerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), primaryPlayerData);
  console.log('Primary player created with ID:', primaryPlayerRef.id);
  playerIds.push(primaryPlayerRef.id);

  // Create partner player if it's a doubles registration
  if (registration.partnerName && registration.partnerName.trim() !== '') {
    console.log('Creating partner player for doubles registration');
    const partnerPlayerData = cleanFirebaseData({
      tournamentId,
      registrationId,
      name: registration.partnerName,
      email: registration.partnerEmail,
      phone: registration.partnerPhone,
      age: registration.age, // Assuming same age for partner, could be updated
      gender: registration.gender, // Assuming same gender for partner, could be updated
      tower: registration.partnerTower,
      flatNumber: registration.partnerFlatNumber,
      emergencyContact: registration.emergencyContact,
      expertiseLevel: registration.expertiseLevel,
      previousExperience: registration.previousExperience,
      isResident: registration.isResident,
      selectedCategory: registration.selectedCategory,
      status: 'active' as const,
      partnerId: primaryPlayerRef.id,
      partnerName: registration.name,
      paymentStatus: registration.paymentStatus,
      paymentReference: registration.paymentReference,
      paymentAmount: registration.paymentAmount,
      paymentMethod: registration.paymentMethod,
      paymentVerifiedAt: registration.paymentVerifiedAt,
      paymentVerifiedBy: registration.paymentVerifiedBy,
      createdAt: new Date(),
    });

    console.log('Creating partner player with data:', partnerPlayerData);
    const partnerPlayerRef = await addDoc(collection(db, 'tournaments', tournamentId, 'players'), partnerPlayerData);
    console.log('Partner player created with ID:', partnerPlayerRef.id);
    playerIds.push(partnerPlayerRef.id);

    // Update primary player with partner reference
    console.log('Updating primary player with partner reference');
    await updateDoc(doc(db, 'tournaments', tournamentId, 'players', primaryPlayerRef.id), {
      partnerId: partnerPlayerRef.id,
      partnerName: registration.partnerName,
    });
  }

  console.log('Player creation completed. Player IDs:', playerIds);
  return playerIds;
}
