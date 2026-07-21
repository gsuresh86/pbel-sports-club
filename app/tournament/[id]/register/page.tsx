'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tournament, CategoryType } from '@/types';
import {
  calculateRegistrationPaymentAmount,
  contactPhoneTelHref,
  createPlayersFromRegistration,
  getTournamentContacts,
} from '@/lib/utils';
import { ProfilePhotoUpload } from '@/components/ui/profile-photo-upload';
import { Calendar, MapPin, Trophy, Clock, CheckCircle, AlertCircle, ScrollText, MessageCircle, User, Phone } from 'lucide-react';
import Link from 'next/link';

// --------------- validation ---------------
type FormErrors = Partial<Record<string, string>>;

const DOUBLES_CATEGORIES: CategoryType[] = ['mens-doubles', 'womens-doubles', 'mixed-doubles', 'family-doubles'];
const TEAM_CATEGORIES: CategoryType[] = ['mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team'];

const CATEGORY_LABELS: Record<string, string> = {
  'girls-under-13': 'Girls Under 13',
  'boys-under-13': 'Boys Under 13',
  'girls-under-18': 'Girls Under 18',
  'boys-under-18': 'Boys Under 18',
  'mens-single': 'Mens Single',
  'womens-single': 'Womens Single',
  'mens-doubles': 'Mens Doubles',
  'womens-doubles': 'Womens Doubles',
  'mixed-doubles': 'Mixed Doubles',
  'family-doubles': 'Family Doubles',
  'mens-team': 'Mens Team',
  'womens-team': 'Womens Team',
  'kids-team-u13': 'Kids Team (U13)',
  'kids-team-u18': 'Kids Team (U18)',
  'open-team': 'Open Team',
};

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const DEFAULT_PAYMENT_METHOD = 'phone_number' as const;
function isDoublesCategory(category: string): boolean {
  return DOUBLES_CATEGORIES.includes(category as CategoryType);
}

function isTeamCategory(category: string): boolean {
  return TEAM_CATEGORIES.includes(category as CategoryType);
}

function parseDateOfBirth(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function calculateAgeOnDate(dateOfBirth: string, referenceDate: Date): number | null {
  const birthDate = parseDateOfBirth(dateOfBirth);
  if (!birthDate || Number.isNaN(referenceDate.getTime())) return null;

  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasPassed =
    referenceDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (referenceDate.getUTCMonth() === birthDate.getUTCMonth() &&
      referenceDate.getUTCDate() >= birthDate.getUTCDate());

  if (!birthdayHasPassed) age -= 1;
  return age;
}

function validateForm(
  formData: ReturnType<typeof getInitialFormData>,
  tournament: Tournament | null
): FormErrors {
  const errors: FormErrors = {};
  const showTowerAndFlat = tournament?.showTowerAndFlat ?? true;
  const showEmergencyContact = tournament?.showEmergencyContact ?? true;
  const showTshirtSize = tournament?.showTshirtSize ?? false;

  if (!formData.selectedCategory) errors.selectedCategory = 'Please select a category';
  if (!formData.name.trim()) errors.name = 'Full name is required';
  if (!formData.email.trim()) errors.email = 'Email address is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Enter a valid email address';
  if (!formData.phone.trim()) errors.phone = 'Phone number is required';
  else if (!/^\+?[\d\s\-]{7,15}$/.test(formData.phone)) errors.phone = 'Enter a valid phone number';
  const birthDate = parseDateOfBirth(formData.dateOfBirth);
  const ageReferenceDate = tournament?.startDate ?? new Date();
  const age = calculateAgeOnDate(formData.dateOfBirth, ageReferenceDate);
  if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
  else if (!birthDate) errors.dateOfBirth = 'Enter a valid date of birth';
  else if (birthDate > new Date()) errors.dateOfBirth = 'Date of birth cannot be in the future';
  else if (age === null || age < 1 || age > 100) errors.dateOfBirth = 'Enter a valid date of birth';
  if (!formData.gender) errors.gender = 'Gender is required';

  if (showEmergencyContact && !formData.emergencyContact.trim()) {
    errors.emergencyContact = 'Emergency contact is required';
  }

  if (showTowerAndFlat) {
    if (!formData.tower) errors.tower = 'Tower is required';
    if (!formData.flatNumber.trim()) errors.flatNumber = 'Flat number is required';
  }

  if (showTshirtSize && !formData.tshirtSize) {
    errors.tshirtSize = 'T-shirt size is required';
  }

  const cat = formData.selectedCategory;

  if (cat && age !== null) {
    if ((cat === 'girls-under-13' || cat === 'boys-under-13' || cat === 'kids-team-u13') && age >= 13)
      errors.dateOfBirth = 'This category is for players under 13 years old on the tournament start date';
    if ((cat === 'girls-under-18' || cat === 'boys-under-18' || cat === 'kids-team-u18') && age >= 18)
      errors.dateOfBirth = 'This category is for players under 18 years old on the tournament start date';
    if ((['mens-single', 'womens-single', 'mens-doubles', 'womens-doubles', 'mixed-doubles', 'family-doubles', 'mens-team', 'womens-team'] as string[]).includes(cat) && age < 18)
      errors.dateOfBirth = 'This category is for adult players (18+) on the tournament start date';
  }

  if (cat && formData.gender) {
    if ((cat === 'boys-under-13' || cat === 'boys-under-18' || cat === 'mens-single' || cat === 'mens-doubles' || cat === 'mens-team') && formData.gender !== 'male')
      errors.gender = 'This category is for male players only';
    if ((cat === 'girls-under-13' || cat === 'girls-under-18' || cat === 'womens-single' || cat === 'womens-doubles' || cat === 'womens-team') && formData.gender !== 'female')
      errors.gender = 'This category is for female players only';
  }

  if (isDoublesCategory(formData.selectedCategory)) {
    if (!formData.partnerName.trim()) errors.partnerName = 'Partner name is required';
    if (!formData.partnerPhone.trim()) errors.partnerPhone = 'Partner phone is required';
    else if (!/^\+?[\d\s\-]{7,15}$/.test(formData.partnerPhone)) errors.partnerPhone = 'Enter a valid phone number';
    if (!formData.partnerEmail.trim()) errors.partnerEmail = 'Partner email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.partnerEmail)) errors.partnerEmail = 'Enter a valid email address';
    const partnerBirthDate = parseDateOfBirth(formData.partnerDateOfBirth);
    const partnerAge = calculateAgeOnDate(formData.partnerDateOfBirth, ageReferenceDate);
    if (!formData.partnerDateOfBirth) errors.partnerDateOfBirth = 'Partner date of birth is required';
    else if (!partnerBirthDate) errors.partnerDateOfBirth = 'Enter a valid date of birth';
    else if (partnerBirthDate > new Date()) errors.partnerDateOfBirth = 'Date of birth cannot be in the future';
    else if (partnerAge === null || partnerAge < 1 || partnerAge > 100) errors.partnerDateOfBirth = 'Enter a valid date of birth';

    if (showTowerAndFlat) {
      if (!formData.partnerTower) errors.partnerTower = 'Partner tower is required';
      if (!formData.partnerFlatNumber.trim()) errors.partnerFlatNumber = 'Partner flat number is required';
    }
  }

  const hasDoublesOrFee = isDoublesCategory(formData.selectedCategory) || (tournament?.entryFee ?? 0) > 0;
  if (hasDoublesOrFee) {
    if (!formData.paymentReference.trim()) errors.paymentReference = 'Payment reference is required';
    if ((tournament?.paymentAccounts?.length ?? 0) > 0 && !formData.selectedPaymentAccount.trim()) {
      errors.selectedPaymentAccount = 'Please select who you paid';
    }
  }

  return errors;
}

function getInitialFormData() {
  return {
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    tower: '',
    flatNumber: '',
    emergencyContact: '',
    expertiseLevel: 'beginner',
    isResident: true,
    selectedCategory: '',
    tshirtSize: '',
    partnerName: '',
    partnerPhone: '',
    partnerEmail: '',
    partnerDateOfBirth: '',
    partnerTower: '',
    partnerFlatNumber: '',
    paymentReference: '',
    profilePhotoUrl: null as string | null,
    partnerProfilePhotoUrl: null as string | null,
    isVolunteer: false,
    teamPreference: '',
    partnerTshirtSize: '',
    selectedPaymentAccount: '',
  };
}

// --------------- field error component ---------------
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

// --------------- main component ---------------
export default function TournamentRegistrationPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState(getInitialFormData());
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoUploadStateRef = useRef({ player: false, partner: false });
  const [registrationCount, setRegistrationCount] = useState<number | null>(null);
  const [partnerRegistrationCount, setPartnerRegistrationCount] = useState<number | null>(null);
  const profilePhotoPrefilledRef = useRef(false);
  const partnerPhotoPrefilledRef = useRef(false);
  const LIMIT_REGISTRATIONS_PER_PARTICIPANT = tournament?.limitRegistrationsPerParticipant ?? true;
  const MAX_REGISTRATIONS_PER_PARTICIPANT = tournament?.maxRegistrationsPerParticipant ?? 3;

  const setPhotoUploadState = useCallback((key: 'player' | 'partner', uploading: boolean) => {
    photoUploadStateRef.current[key] = uploading;
    setPhotoUploading(
      photoUploadStateRef.current.player || photoUploadStateRef.current.partner
    );
  }, []);

  const refreshPrimaryParticipantCheck = async () => {
    const nameVal = formData.name.trim();
    const phoneVal = formData.phone.trim();
    if (!nameVal || !phoneVal || !/^\+?[\d\s\-]{7,15}$/.test(phoneVal)) return;
    try {
      const params = new URLSearchParams({ name: nameVal, phone: phoneVal });
      const res = await fetch(
        `/api/tournaments/${tournamentId}/registration-stats?${params.toString()}`
      );
      if (!res.ok) return;
      const { count, profilePhotoUrl } = (await res.json()) as {
        count: number;
        profilePhotoUrl: string | null;
      };
      setRegistrationCount(count);
      if (profilePhotoUrl && !formData.profilePhotoUrl) {
        setFormData(prev => ({ ...prev, profilePhotoUrl }));
        profilePhotoPrefilledRef.current = true;
      }
    } catch {
      // silently ignore — submit will re-check
    }
  };

  const refreshPartnerParticipantCheck = async () => {
    const nameVal = formData.partnerName.trim();
    const phoneVal = formData.partnerPhone.trim();
    if (!nameVal || !phoneVal || !/^\+?[\d\s\-]{7,15}$/.test(phoneVal)) return;
    try {
      const params = new URLSearchParams({ name: nameVal, phone: phoneVal });
      const res = await fetch(
        `/api/tournaments/${tournamentId}/registration-stats?${params.toString()}`
      );
      if (!res.ok) return;
      const { count, profilePhotoUrl } = (await res.json()) as {
        count: number;
        profilePhotoUrl: string | null;
      };
      setPartnerRegistrationCount(count);
      if (profilePhotoUrl && !formData.partnerProfilePhotoUrl) {
        setFormData(prev => ({ ...prev, partnerProfilePhotoUrl: profilePhotoUrl }));
        partnerPhotoPrefilledRef.current = true;
      }
    } catch {
      // silently ignore
    }
  };

  const handleNameBlur = async () => {
    touch('name');
    await refreshPrimaryParticipantCheck();
  };

  const handlePhoneBlur = async () => {
    touch('phone');
    const phoneVal = formData.phone.trim();
    if (!phoneVal || !/^\+?[\d\s\-]{7,15}$/.test(phoneVal)) return;
    await refreshPrimaryParticipantCheck();
  };

  const handlePartnerNameBlur = async () => {
    touch('partnerName');
    await refreshPartnerParticipantCheck();
  };

  const handlePartnerPhoneBlur = async () => {
    touch('partnerPhone');
    const phoneVal = formData.partnerPhone.trim();
    if (!phoneVal || !/^\+?[\d\s\-]{7,15}$/.test(phoneVal)) return;
    await refreshPartnerParticipantCheck();
  };

  useEffect(() => {
    if (tournamentId) loadTournament();
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'tournaments', tournamentId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTournament({
          id: docSnap.id,
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
          registrationDeadline: data.registrationDeadline?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Tournament);
      } else {
        setSubmitError('Tournament not found');
      }
    } catch {
      setSubmitError('Failed to load tournament details');
    } finally {
      setLoading(false);
    }
  };

  const generateRegistrationCode = () =>
    'REG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();

  const touch = (field: string) => setTouched(prev => new Set(prev).add(field));

  const updateField = (field: string, value: string | boolean) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    setErrors(validateForm(next, tournament));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched and validate
    const allErrors = validateForm(formData, tournament);
    setErrors(allErrors);
    const allFields = new Set([
      'selectedCategory', 'name', 'email', 'phone', 'dateOfBirth', 'gender',
      'tower', 'flatNumber', 'emergencyContact', 'tshirtSize',
      'partnerName', 'partnerPhone', 'partnerEmail', 'partnerDateOfBirth',
      'partnerTower', 'partnerFlatNumber',
      'paymentReference',
    ]);
    setTouched(allFields);

    if (Object.keys(allErrors).length > 0) {
      setSubmitError('Please fix the errors above before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      if (!tournament?.registrationOpen) throw new Error('Registration is closed for this tournament');
      if (new Date() > tournament!.registrationDeadline) throw new Error('Registration deadline has passed');
      if (tournament!.currentParticipants >= tournament!.maxParticipants) throw new Error('Tournament is full');

      const showTowerAndFlat = tournament?.showTowerAndFlat ?? true;
      const showEmergencyContact = tournament?.showEmergencyContact ?? true;
      const showIsResident = tournament?.showIsResident ?? true;
      const showTshirtSize = tournament?.showTshirtSize ?? false;
      const showVolunteerNomination = tournament?.showVolunteerNomination ?? false;
      const ageReferenceDate = tournament?.startDate ?? new Date();
      const age = calculateAgeOnDate(formData.dateOfBirth, ageReferenceDate);
      const partnerAge = formData.partnerDateOfBirth
        ? calculateAgeOnDate(formData.partnerDateOfBirth, ageReferenceDate)
        : null;

      if (age === null) {
        throw new Error('Unable to calculate age from the date of birth.');
      }

      const registrationPayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        age,
        gender: formData.gender as 'male' | 'female' | 'other',
        ...(showTowerAndFlat ? { tower: formData.tower, flatNumber: formData.flatNumber } : {}),
        ...(showEmergencyContact ? { emergencyContact: formData.emergencyContact } : {}),
        expertiseLevel: formData.expertiseLevel as 'beginner' | 'intermediate' | 'advanced' | 'expert',
        ...(showIsResident ? { isResident: formData.isResident } : {}),
        ...(showTshirtSize ? { tshirtSize: formData.tshirtSize } : {}),
        ...(showTshirtSize && isDoublesCategory(formData.selectedCategory)
          ? { partnerTshirtSize: formData.partnerTshirtSize || null }
          : {}),
        ...(showVolunteerNomination ? { isVolunteer: formData.isVolunteer } : {}),
        ...(isTeamCategory(formData.selectedCategory) && formData.teamPreference
          ? { teamPreference: formData.teamPreference }
          : {}),
        selectedCategory: formData.selectedCategory as CategoryType,
        partnerName: formData.partnerName || null,
        partnerPhone: formData.partnerPhone || null,
        partnerEmail: formData.partnerEmail || null,
        partnerDateOfBirth: formData.partnerDateOfBirth || null,
        partnerAge,
        ...(showTowerAndFlat
          ? { partnerTower: formData.partnerTower || null, partnerFlatNumber: formData.partnerFlatNumber || null }
          : {}),
        ...(formData.profilePhotoUrl ? { profilePhotoUrl: formData.profilePhotoUrl } : {}),
        ...(formData.partnerProfilePhotoUrl
          ? { partnerProfilePhotoUrl: formData.partnerProfilePhotoUrl }
          : {}),
        paymentReference: formData.paymentReference || null,
        selectedPaymentAccount: formData.selectedPaymentAccount || null,
        paymentMethod: DEFAULT_PAYMENT_METHOD,
      };

      const apiRes = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationPayload),
      });
      const apiResult = await apiRes.json().catch(() => ({}));

      if (!apiRes.ok) {
        // Fall back to client write only when Admin SDK is not configured.
        if (apiRes.status !== 503) {
          throw new Error(
            typeof apiResult.error === 'string' ? apiResult.error : 'Failed to register'
          );
        }

        const existingCount = 0;
        const partnerExistingCount = 0;
        const registrationData = {
          ...registrationPayload,
          tournamentId,
          paymentAmount: calculateRegistrationPaymentAmount(
            tournament!,
            formData.selectedCategory,
            existingCount,
            partnerExistingCount
          ),
          registrationStatus: 'pending',
          paymentStatus: 'pending',
          registrationCode: generateRegistrationCode(),
          registeredAt: new Date(),
        };
        const registrationRef = await addDoc(
          collection(db, 'tournaments', tournamentId, 'registrations'),
          registrationData
        );
        try {
          const { upsertPublicPlayer } = await import('@/lib/public-players');
          await upsertPublicPlayer(db, tournamentId, registrationRef.id, {
            name: formData.name,
            partnerName: formData.partnerName || undefined,
            profilePhotoUrl: formData.profilePhotoUrl || undefined,
            partnerProfilePhotoUrl: formData.partnerProfilePhotoUrl || undefined,
            selectedCategory: formData.selectedCategory as CategoryType,
          });
        } catch (err) {
          console.error('Error writing public player projection:', err);
        }
        try {
          await createPlayersFromRegistration(registrationData, tournamentId, registrationRef.id, db);
        } catch (err) {
          console.error('Error creating players:', err);
        }
        try {
          await fetch('/api/notify-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tournamentId,
              tournamentName: tournament?.name || 'Tournament',
              playerName: formData.name,
              registrationId: registrationRef.id,
            }),
          });
        } catch (err) {
          console.error('Error sending notification:', err);
        }
        setSuccess(true);
        return;
      }

      if (typeof apiResult.priorRegistrations === 'number') {
        setRegistrationCount(apiResult.priorRegistrations);
      }

      try {
        const res = await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId,
            tournamentName: tournament?.name || 'Tournament',
            playerName: formData.name,
            registrationId: apiResult.registrationId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('notify-registration failed:', err.error || res.status);
        }
      } catch (err) {
        console.error('Error sending notification:', err);
      }

      setSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isRegistrationOpen = () =>
    !!tournament && tournament.registrationOpen && new Date() <= tournament.registrationDeadline;

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton': return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'table-tennis': return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'volleyball': return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      default: return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (submitError && !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{submitError}</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h1>
            <p className="text-gray-600 mb-4">
              Thank you for registering for <strong>{tournament?.name}</strong>. Your registration is pending approval.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You will receive a confirmation email once your registration is approved.
            </p>
            {tournament?.whatsappGroupLink && (
              <a
                href={tournament.whatsappGroupLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full mb-4 px-4 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                Join WhatsApp Group
              </a>
            )}
            <div className="space-y-2">
              <Link href="/" className="block"><Button className="w-full">Go Home</Button></Link>
              <Link href="/schedules" className="block"><Button variant="outline" className="w-full">View Schedules</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showTowerAndFlat = tournament?.showTowerAndFlat ?? true;
  const showEmergencyContact = tournament?.showEmergencyContact ?? true;
  const showIsResident = tournament?.showIsResident ?? true;
  const showTshirtSize = tournament?.showTshirtSize ?? false;
  const showVolunteerNomination = tournament?.showVolunteerNomination ?? false;
  const isDoubles = isDoublesCategory(formData.selectedCategory);
  const isTeam = isTeamCategory(formData.selectedCategory);

  const DOUBLES_FEE = tournament?.doublesFee ?? 700;
  const REPEAT_FEE = tournament?.repeatFee ?? 300;

  const isReturningParticipant = registrationCount !== null && registrationCount > 0;
  const isPartnerReturning = partnerRegistrationCount !== null && partnerRegistrationCount > 0;

  const primaryFee = (() => {
    if (isDoubles) return isReturningParticipant ? REPEAT_FEE : DOUBLES_FEE;
    if (!tournament?.entryFee) return 0;
    return isReturningParticipant ? REPEAT_FEE : tournament.entryFee;
  })();

  const partnerFee = isDoubles
    ? (isPartnerReturning ? REPEAT_FEE : DOUBLES_FEE)
    : 0;

  const effectiveFee =
    registrationCount !== null && (isDoubles ? partnerRegistrationCount !== null : true)
      ? calculateRegistrationPaymentAmount(
          tournament!,
          formData.selectedCategory,
          registrationCount,
          partnerRegistrationCount ?? 0
        )
      : primaryFee + partnerFee;
  const hasPayment = effectiveFee > 0;
  const hasPaymentAccounts = (tournament?.paymentAccounts?.length ?? 0) > 0;

  const err = (field: string) => (touched.has(field) ? errors[field] : undefined);

  const tournamentContacts = tournament ? getTournamentContacts(tournament) : [];
  const hasContact = tournamentContacts.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="relative h-80 w-full overflow-hidden">
        <img
          src={tournament?.banner || getSportBanner(tournament?.sport || 'badminton')}
          alt={`${tournament?.name} banner`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4 pb-12">
          <Trophy className="h-16 w-16 mb-4 text-yellow-400" />
          {tournament?.showRegistrationTitle !== false && (
            <h1 className="text-3xl sm:text-5xl font-bold mb-3 drop-shadow-lg max-w-4xl">{tournament?.name}</h1>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-4 flex flex-row items-center justify-between gap-2 text-xs sm:text-lg text-white px-4">
          <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Calendar className="h-3.5 w-3.5 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">
              {new Date(tournament!.startDate).toLocaleDateString()} – {new Date(tournament!.endDate).toLocaleDateString()}
            </span>
          </span>
          <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="truncate">{tournament?.venue}</span>
          </span>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Tournament info card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 p-6">
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-800 capitalize">{tournament?.sport}</Badge>
                {isRegistrationOpen() ? (
                  <Badge className="bg-green-100 text-green-800">Registration Open</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Registration Closed</Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                {tournament?.name}
              </h2>
              <div className="flex flex-col gap-1.5 text-sm text-gray-600">
                <span className="flex items-start gap-1.5">
                  <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {new Date(tournament!.startDate).toLocaleDateString()} – {new Date(tournament!.endDate).toLocaleDateString()}
                </span>
                <span className="flex items-start gap-1.5">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {tournament?.venue}
                </span>
              </div>
            </div>

            {tournament?.description && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2 text-gray-900">Description</h3>
                <p className="text-gray-600">{tournament.description}</p>
              </div>
            )}

            <div className="text-sm mb-4">
              <p><strong>Registration Deadline:</strong> {new Date(tournament!.registrationDeadline).toLocaleDateString()}</p>
            </div>

            {hasContact && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                  Point of Contact
                </h3>
                <div className="flex flex-col gap-2 text-sm text-gray-700">
                  {tournamentContacts.map((contact, idx) => (
                    <p key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <User className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      {contact.name && (
                        <span className="font-medium text-gray-900">{contact.name}</span>
                      )}
                      {contact.name && contact.phone && (
                        <span className="text-gray-400" aria-hidden="true">·</span>
                      )}
                      {contact.phone && (
                        <a
                          href={contactPhoneTelHref(contact.phone)}
                          className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 hover:underline font-medium"
                        >
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          {contact.phone}
                        </a>
                      )}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-emerald-800/80 mt-2">
                  Questions about registration or payment? Reach out to {tournamentContacts.length > 1 ? 'either contact' : 'the contact'} above.
                </p>
              </div>
            )}

            {tournament?.rules && (
              <Link
                href={`/tournament/${tournamentId}/rules`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ScrollText className="h-4 w-4 flex-shrink-0" />
                View Rules &amp; Regulations
              </Link>
            )}
          </div>

          {/* Registration form */}
          {isRegistrationOpen() ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Form</h2>
                <p className="text-gray-600">Fill in your details to register for this tournament</p>
              </div>

              {submitError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{submitError}</p>
                </div>
              )}

              {LIMIT_REGISTRATIONS_PER_PARTICIPANT && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>Each participant may register for up to <strong>{MAX_REGISTRATIONS_PER_PARTICIPANT} categories</strong> per tournament. Repeat category fees apply after the first registration.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                {/* ── Row: Category + Playing Level ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="selectedCategory">Select Category *</Label>
                    <Select
                      value={formData.selectedCategory}
                      onValueChange={(v) => { touch('selectedCategory'); updateField('selectedCategory', v); }}
                    >
                      <SelectTrigger className={`w-full ${err('selectedCategory') ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select your category" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournament?.categories?.map(category => (
                          <SelectItem key={category} value={category}>
                            {CATEGORY_LABELS[category] ?? category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={err('selectedCategory')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="expertiseLevel">Playing Level *</Label>
                    <Select value={formData.expertiseLevel} onValueChange={(v) => updateField('expertiseLevel', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ── Row: Full Name + Email ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => { updateField('name', e.target.value); setRegistrationCount(null); if (profilePhotoPrefilledRef.current) { setFormData(prev => ({ ...prev, profilePhotoUrl: null })); profilePhotoPrefilledRef.current = false; } }}
                      onBlur={handleNameBlur}
                      className={err('name') ? 'border-red-500' : ''}
                    />
                    <FieldError message={err('name')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      onBlur={() => touch('email')}
                      className={err('email') ? 'border-red-500' : ''}
                    />
                    <FieldError message={err('email')} />
                  </div>
                </div>

                {/* ── Row: Phone + Emergency Contact ── */}
                <div className={`grid grid-cols-1 gap-4 ${showEmergencyContact ? 'sm:grid-cols-2' : ''}`}>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => { updateField('phone', e.target.value); setRegistrationCount(null); if (profilePhotoPrefilledRef.current) { setFormData(prev => ({ ...prev, profilePhotoUrl: null })); profilePhotoPrefilledRef.current = false; } }}
                      onBlur={handlePhoneBlur}
                      className={err('phone') ? 'border-red-500' : ''}
                    />
                    <FieldError message={err('phone')} />
                    {LIMIT_REGISTRATIONS_PER_PARTICIPANT && registrationCount !== null && registrationCount > 0 && (
                      <p className={`text-xs mt-0.5 flex items-center gap-1 ${registrationCount >= MAX_REGISTRATIONS_PER_PARTICIPANT ? 'text-red-600' : 'text-amber-600'}`}>
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        {registrationCount >= MAX_REGISTRATIONS_PER_PARTICIPANT
                          ? `Already registered for ${registrationCount} categories — limit reached.`
                          : `Already registered for ${registrationCount} of ${MAX_REGISTRATIONS_PER_PARTICIPANT} allowed categories.`}
                      </p>
                    )}
                  </div>
                  {showEmergencyContact && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="emergencyContact">Emergency Contact *</Label>
                      <Input
                        id="emergencyContact"
                        type="tel"
                        value={formData.emergencyContact}
                        onChange={(e) => updateField('emergencyContact', e.target.value)}
                        onBlur={() => touch('emergencyContact')}
                        className={err('emergencyContact') ? 'border-red-500' : ''}
                      />
                      <FieldError message={err('emergencyContact')} />
                    </div>
                  )}
                </div>

                {/* ── Row: Date of birth + Gender ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <DatePickerInput
                      id="dateOfBirth"
                      max={new Date().toISOString().split('T')[0]}
                      value={formData.dateOfBirth}
                      onChange={(value) => updateField('dateOfBirth', value)}
                      onBlur={() => touch('dateOfBirth')}
                      triggerClassName={err('dateOfBirth') ? 'border-red-500' : ''}
                    />
                    <FieldError message={err('dateOfBirth')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(v) => { touch('gender'); updateField('gender', v); }}>
                      <SelectTrigger className={`w-full ${err('gender') ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError message={err('gender')} />
                  </div>
                </div>

                {/* ── Team Preference (for team categories) ── */}
                {isTeam && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="teamPreference">Playing Preference</Label>
                      <Select value={formData.teamPreference} onValueChange={(v) => updateField('teamPreference', v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Singles / Doubles / Both" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="singles">Singles</SelectItem>
                          <SelectItem value="doubles">Doubles</SelectItem>
                          <SelectItem value="both">Both (Singles &amp; Doubles)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <ProfilePhotoUpload
                  label="Your profile photo (optional)"
                  tournamentId={tournamentId}
                  uploadKey="player"
                  value={formData.profilePhotoUrl}
                  onChange={(url) => { profilePhotoPrefilledRef.current = false; setFormData(prev => ({ ...prev, profilePhotoUrl: url })); }}
                  onUploadingChange={(uploading) => setPhotoUploadState('player', uploading)}
                  disabled={submitting}
                />

                {/* ── Row: Tower + Flat (conditional) ── */}
                {showTowerAndFlat && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="tower">Tower *</Label>
                      <Select value={formData.tower} onValueChange={(v) => { touch('tower'); updateField('tower', v); }}>
                        <SelectTrigger className={`w-full ${err('tower') ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select tower" />
                        </SelectTrigger>
                        <SelectContent>
                          {['A','B','C','D','E','F','G','H','J','K','L','M','N','P'].map(t => (
                            <SelectItem key={t} value={t}>Tower {t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={err('tower')} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="flatNumber">Flat Number *</Label>
                      <Input
                        id="flatNumber"
                        value={formData.flatNumber}
                        onChange={(e) => updateField('flatNumber', e.target.value)}
                        onBlur={() => touch('flatNumber')}
                        placeholder="e.g., 101, 201"
                        className={err('flatNumber') ? 'border-red-500' : ''}
                      />
                      <FieldError message={err('flatNumber')} />
                    </div>
                  </div>
                )}

                {/* ── Row: T-Shirt Size (conditional) ── */}
                {showTshirtSize && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="tshirtSize">T-Shirt Size *</Label>
                      <Select value={formData.tshirtSize} onValueChange={(v) => { touch('tshirtSize'); updateField('tshirtSize', v); }}>
                        <SelectTrigger className={`w-full ${err('tshirtSize') ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {TSHIRT_SIZES.map(size => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={err('tshirtSize')} />
                    </div>
                  </div>
                )}

                {/* ── Resident checkbox ── */}
                {showIsResident && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isResident"
                      checked={formData.isResident}
                      onChange={(e) => updateField('isResident', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="isResident" className="mb-0 font-normal cursor-pointer">I am a local resident</Label>
                  </div>
                )}

                {/* ── Volunteer Nomination (conditional) ── */}
                {showVolunteerNomination && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="isVolunteer"
                      checked={formData.isVolunteer}
                      onChange={(e) => updateField('isVolunteer', e.target.checked)}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <Label htmlFor="isVolunteer" className="mb-0 font-medium cursor-pointer">I want to volunteer for this tournament</Label>
                      <p className="text-xs text-amber-700 mt-0.5">Volunteers help with event coordination, score-keeping, and logistics.</p>
                    </div>
                  </div>
                )}

                {/* ── Partner Details ── */}
                {isDoubles && (
                  <div className="border-t pt-5">
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <h3 className="text-base font-semibold text-blue-900 mb-1">Partner Details Required</h3>
                      <p className="text-sm text-blue-700">This is a doubles category. Please provide your partner&apos;s details.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="partnerName">Partner Full Name *</Label>
                          <Input
                            id="partnerName"
                            value={formData.partnerName}
                            onChange={(e) => { updateField('partnerName', e.target.value); setPartnerRegistrationCount(null); if (partnerPhotoPrefilledRef.current) { setFormData(prev => ({ ...prev, partnerProfilePhotoUrl: null })); partnerPhotoPrefilledRef.current = false; } }}
                            onBlur={handlePartnerNameBlur}
                            placeholder="Partner's full name"
                            className={err('partnerName') ? 'border-red-500' : ''}
                          />
                          <FieldError message={err('partnerName')} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="partnerPhone">Partner Phone *</Label>
                          <Input
                            id="partnerPhone"
                            type="tel"
                            value={formData.partnerPhone}
                            onChange={(e) => { updateField('partnerPhone', e.target.value); setPartnerRegistrationCount(null); if (partnerPhotoPrefilledRef.current) { setFormData(prev => ({ ...prev, partnerProfilePhotoUrl: null })); partnerPhotoPrefilledRef.current = false; } }}
                            onBlur={handlePartnerPhoneBlur}
                            placeholder="Partner's phone number"
                            className={err('partnerPhone') ? 'border-red-500' : ''}
                          />
                          <FieldError message={err('partnerPhone')} />
                          {LIMIT_REGISTRATIONS_PER_PARTICIPANT && partnerRegistrationCount !== null && partnerRegistrationCount > 0 && (
                            <p className={`text-xs mt-0.5 flex items-center gap-1 ${partnerRegistrationCount >= MAX_REGISTRATIONS_PER_PARTICIPANT ? 'text-red-600' : 'text-amber-600'}`}>
                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                              {partnerRegistrationCount >= MAX_REGISTRATIONS_PER_PARTICIPANT
                                ? `Partner already registered for ${partnerRegistrationCount} categories — limit reached.`
                                : `Partner already registered for ${partnerRegistrationCount} of ${MAX_REGISTRATIONS_PER_PARTICIPANT} categories.`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="partnerEmail">Partner Email *</Label>
                          <Input
                            id="partnerEmail"
                            type="email"
                            value={formData.partnerEmail}
                            onChange={(e) => updateField('partnerEmail', e.target.value)}
                            onBlur={() => touch('partnerEmail')}
                            placeholder="Partner's email address"
                            className={err('partnerEmail') ? 'border-red-500' : ''}
                          />
                          <FieldError message={err('partnerEmail')} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="partnerDateOfBirth">Partner Date of Birth *</Label>
                          <DatePickerInput
                            id="partnerDateOfBirth"
                            max={new Date().toISOString().split('T')[0]}
                            value={formData.partnerDateOfBirth}
                            onChange={(value) => updateField('partnerDateOfBirth', value)}
                            onBlur={() => touch('partnerDateOfBirth')}
                            triggerClassName={err('partnerDateOfBirth') ? 'border-red-500' : ''}
                          />
                          <FieldError message={err('partnerDateOfBirth')} />
                        </div>
                      </div>
                      <ProfilePhotoUpload
                        label="Partner profile photo (optional)"
                        tournamentId={tournamentId}
                        uploadKey="partner"
                        value={formData.partnerProfilePhotoUrl}
                        onChange={(url) => { partnerPhotoPrefilledRef.current = false; setFormData(prev => ({ ...prev, partnerProfilePhotoUrl: url })); }}
                        onUploadingChange={(uploading) => setPhotoUploadState('partner', uploading)}
                        disabled={submitting}
                      />
                      {showTshirtSize && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="partnerTshirtSize">Partner T-Shirt Size</Label>
                            <Select value={formData.partnerTshirtSize} onValueChange={(v) => updateField('partnerTshirtSize', v)}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                {TSHIRT_SIZES.map(size => (
                                  <SelectItem key={size} value={size}>{size}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      {showTowerAndFlat && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="partnerTower">Partner Tower *</Label>
                            <Select value={formData.partnerTower} onValueChange={(v) => { touch('partnerTower'); updateField('partnerTower', v); }}>
                              <SelectTrigger className={`w-full ${err('partnerTower') ? 'border-red-500' : ''}`}>
                                <SelectValue placeholder="Select partner's tower" />
                              </SelectTrigger>
                              <SelectContent>
                                {['A','B','C','D','E','F','G','H','J','K','L','M','N','P'].map(t => (
                                  <SelectItem key={t} value={t}>Tower {t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldError message={err('partnerTower')} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="partnerFlatNumber">Partner Flat Number *</Label>
                            <Input
                              id="partnerFlatNumber"
                              value={formData.partnerFlatNumber}
                              onChange={(e) => updateField('partnerFlatNumber', e.target.value)}
                              onBlur={() => touch('partnerFlatNumber')}
                              placeholder="e.g., 101, 201"
                              className={err('partnerFlatNumber') ? 'border-red-500' : ''}
                            />
                            <FieldError message={err('partnerFlatNumber')} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Payment Section ── */}
                {hasPayment && (
                  <div className="border-t pt-5">
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                      <h3 className="text-base font-semibold text-yellow-900 mb-1">Payment Required</h3>
                      <p className="text-sm text-yellow-700">
                        Total: <strong>₹{effectiveFee}</strong>. Complete payment then provide the reference number.
                      </p>
                      {isDoubles && (
                        <div className="mt-2 text-xs text-yellow-700 space-y-0.5 border-t border-yellow-200 pt-2">
                          <p>You: ₹{primaryFee}{isReturningParticipant ? ' (returning rate)' : ''}</p>
                          {formData.partnerEmail && (
                            <p>Partner: ₹{partnerFee}{isPartnerReturning ? ' (returning rate)' : ''}</p>
                          )}
                        </div>
                      )}
                      {!isDoubles && isReturningParticipant && (
                        <p className="text-xs text-yellow-600 mt-1">Returning participant rate applied.</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      {hasPaymentAccounts && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="selectedPaymentAccount">Pay To *</Label>
                          <Select
                            value={formData.selectedPaymentAccount}
                            onValueChange={(v) => updateField('selectedPaymentAccount', v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select payment recipient" />
                            </SelectTrigger>
                            <SelectContent>
                              {tournament!.paymentAccounts!.map((acc, i) => (
                                <SelectItem key={i} value={`${acc.name}||${acc.number}`}>
                                  {acc.name} — {acc.number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldError message={err('selectedPaymentAccount')} />
                          {formData.selectedPaymentAccount && (() => {
                            const [, num] = formData.selectedPaymentAccount.split('||');
                            return (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Pay to: <span className="font-medium text-gray-800 select-all">{num}</span>
                              </p>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="paymentReference">Reference Number *</Label>
                        <Input
                          id="paymentReference"
                          value={formData.paymentReference}
                          onChange={(e) => updateField('paymentReference', e.target.value)}
                          onBlur={() => touch('paymentReference')}
                          placeholder="Transaction / UPI reference"
                          className={err('paymentReference') ? 'border-red-500' : ''}
                        />
                        <FieldError message={err('paymentReference')} />
                      </div>

                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-green-900 mb-3">Pay via Phone / UPI — ₹{effectiveFee}</h4>
                        {formData.selectedPaymentAccount ? (() => {
                            const [accName, accNumber] = formData.selectedPaymentAccount.split('||');
                            return (
                              <div className="flex flex-col gap-1">
                                <p className="text-sm text-green-700">Send ₹{effectiveFee} to:</p>
                                <div className="bg-white border border-green-200 rounded-lg px-4 py-3 flex flex-col gap-0.5">
                                  <p className="text-xs text-green-600">{accName}</p>
                                  <p className="text-lg font-semibold text-green-900 select-all tracking-wide">{accNumber}</p>
                                </div>
                                <p className="text-xs text-green-600 mt-1">After payment, enter the UPI transaction reference number above.</p>
                              </div>
                            );
                          })() : hasPaymentAccounts ? (
                            <p className="text-sm text-green-700">Select a payment recipient above, then send ₹{effectiveFee} via UPI/phone number and enter the reference number above.</p>
                          ) : (
                            <p className="text-sm text-green-700">Complete payment via UPI/phone number, then enter the transaction reference number above.</p>
                          )}
                        </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Link href="/"><Button type="button" variant="outline">Cancel</Button></Link>
                  <Button type="submit" disabled={submitting || photoUploading}>
                    {submitting ? 'Registering...' : photoUploading ? 'Uploading photo...' : 'Register'}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Registration Closed</h3>
              <p className="text-gray-600 mb-4">
                Registration for this tournament is currently closed.
                {!tournament!.registrationOpen && ' Registration is disabled.'}
                {new Date() > tournament!.registrationDeadline && ' The registration deadline has passed.'}
              </p>
              <Link href="/"><Button>Go Home</Button></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
