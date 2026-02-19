'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tournament, TournamentType, CategoryType, Registration, Player } from '@/types';
import { createPlayersFromRegistration } from '@/lib/utils';
import { Calendar, MapPin, Users, Trophy, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function TournamentRegistrationPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    gender: '',
    tower: '',
    flatNumber: '',
    emergencyContact: '',
    expertiseLevel: 'beginner',
    previousExperience: '',
    isResident: true,
    selectedCategory: '',
    // Partner details
    partnerName: '',
    partnerPhone: '',
    partnerEmail: '',
    partnerTower: '',
    partnerFlatNumber: '',
    // Payment details
    paymentReference: '',
    paymentMethod: 'qr_code',
  });

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const docRef = doc(db, 'tournaments', tournamentId);
      const docSnap = await getDoc(docRef);
      
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
        setError('Tournament not found');
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      setError('Failed to load tournament details');
    } finally {
      setLoading(false);
    }
  };

  const generateRegistrationCode = () => {
    return 'REG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Check if tournament is still accepting registrations
      if (!tournament?.registrationOpen) {
        throw new Error('Registration is closed for this tournament');
      }

      if (new Date() > tournament!.registrationDeadline) {
        throw new Error('Registration deadline has passed');
      }

      if (tournament!.currentParticipants >= tournament!.maxParticipants) {
        throw new Error('Tournament is full');
      }

      // Check if user already registered
      const existingRegistration = await checkExistingRegistration(formData.email, tournamentId);
      if (existingRegistration) {
        throw new Error('You have already registered for this tournament');
      }

      // Validate partner details for doubles tournaments
      const showTowerAndFlat = tournament?.showTowerAndFlat ?? true;
      const showEmergencyContact = tournament?.showEmergencyContact ?? true;
      const showIsResident = tournament?.showIsResident ?? true;

      if (formData.selectedCategory === 'mens-doubles' || formData.selectedCategory === 'mixed-doubles') {
        if (!formData.partnerName || !formData.partnerPhone || !formData.partnerEmail) {
          throw new Error('Partner details are required for doubles tournaments');
        }
        if (showTowerAndFlat && (!formData.partnerTower || !formData.partnerFlatNumber)) {
          throw new Error('Partner tower and flat number are required for doubles tournaments');
        }
      }

      // Validate selected category
      if (!formData.selectedCategory) {
        throw new Error('Please select a category');
      }

      // Validate age for selected category
      const age = parseInt(formData.age);
      if ((formData.selectedCategory === 'girls-under-13' || formData.selectedCategory === 'boys-under-13' || formData.selectedCategory === 'kids-team-u13') && age >= 13) {
        throw new Error('This category is for players under 13 years old');
      }
      if ((formData.selectedCategory === 'girls-under-18' || formData.selectedCategory === 'boys-under-18' || formData.selectedCategory === 'kids-team-u18') && age >= 18) {
        throw new Error('This category is for players under 18 years old');
      }
      if ((formData.selectedCategory === 'mens-single' || formData.selectedCategory === 'womens-single' || 
           formData.selectedCategory === 'mens-doubles' || formData.selectedCategory === 'mixed-doubles' ||
           formData.selectedCategory === 'mens-team' || formData.selectedCategory === 'womens-team') && age < 18) {
        throw new Error('This category is for adult players (18+ years old)');
      }

      // Validate gender for selected category
      if ((formData.selectedCategory === 'boys-under-13' || formData.selectedCategory === 'boys-under-18' || 
           formData.selectedCategory === 'mens-single' || formData.selectedCategory === 'mens-doubles' || 
           formData.selectedCategory === 'mens-team') && formData.gender !== 'male') {
        throw new Error('This category is for male players only');
      }
      if ((formData.selectedCategory === 'girls-under-13' || formData.selectedCategory === 'girls-under-18' || 
           formData.selectedCategory === 'womens-single' || formData.selectedCategory === 'womens-team') && formData.gender !== 'female') {
        throw new Error('This category is for female players only');
      }

      const registrationData = {
        tournamentId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        age: parseInt(formData.age),
        gender: formData.gender as 'male' | 'female' | 'other',
        ...(showTowerAndFlat ? { tower: formData.tower, flatNumber: formData.flatNumber } : {}),
        ...(showEmergencyContact ? { emergencyContact: formData.emergencyContact } : {}),
        expertiseLevel: formData.expertiseLevel as 'beginner' | 'intermediate' | 'advanced' | 'expert',
        previousExperience: formData.previousExperience || null,
        ...(showIsResident ? { isResident: formData.isResident } : {}),
        selectedCategory: formData.selectedCategory as CategoryType,
        // Partner details
        partnerName: formData.partnerName || null,
        partnerPhone: formData.partnerPhone || null,
        partnerEmail: formData.partnerEmail || null,
        ...(showTowerAndFlat ? { partnerTower: formData.partnerTower || null, partnerFlatNumber: formData.partnerFlatNumber || null } : {}),
        // Payment details
        paymentReference: formData.paymentReference || null,
        paymentAmount: tournament?.entryFee || 0,
        paymentMethod: formData.paymentMethod,
        registrationStatus: 'pending',
        paymentStatus: 'pending',
        registrationCode: generateRegistrationCode(),
        registeredAt: new Date(),
      };

      // Add registration to tournament's registrations subcollection
      const registrationRef = await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), registrationData);
      console.log('Registration created with ID:', registrationRef.id);
      
      // Notify tournament admin about new registration (server-side so it works for public users)
      try {
        const res = await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId,
            tournamentName: tournament?.name || 'Tournament',
            playerName: formData.name,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } catch (error) {
        console.error('Error sending notification:', error);
        // Don't fail the registration if notification fails
      }
      
      // Automatically create players from the registration
      try {
        console.log('Creating players from registration...');
        const playerIds = await createPlayersFromRegistration(registrationData, tournamentId, registrationRef.id, db);
        console.log('Players created with IDs:', playerIds);
      } catch (playerError) {
        console.error('Error creating players from registration:', playerError);
        // Don't fail the registration if player creation fails
      }

      // Participant count is incremented server-side by /api/notify-registration (no client write to tournaments)

      setSuccess(true);
    } catch (error: unknown) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Failed to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const checkExistingRegistration = async (email: string, tournamentId: string) => {
    // This would typically be done with a query, but for simplicity we'll assume it's handled
    // In a real implementation, you'd query the participants collection
    return false;
  };

  const isRegistrationOpen = () => {
    if (!tournament) return false;
    return tournament.registrationOpen && 
           new Date() <= tournament.registrationDeadline;
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

  if (error && !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
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
              Thank you for registering for <strong>{tournament?.name}</strong>. 
              Your registration is pending approval.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You will receive a confirmation email once your registration is approved.
            </p>
            <div className="space-y-2">
              <Link href="/" className="block">
                <Button className="w-full">Go Home</Button>
              </Link>
              <Link href="/schedules" className="block">
                <Button variant="outline" className="w-full">View Schedules</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getSportBanner = (sport: string) => {
    switch (sport) {
      case 'badminton':
        return 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'table-tennis':
        return 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      case 'volleyball':
        return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
      default:
        return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400&q=80';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Tournament Banner */}
      <div className="relative h-80 w-full overflow-hidden">
        <img
          src={tournament?.banner || getSportBanner(tournament?.sport || 'badminton')}
          alt={`${tournament?.name} tournament banner`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60 flex items-center justify-center">
          <div className="text-center text-white max-w-4xl px-4">
            <div className="mb-4">
              <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-400" />
            </div>
            <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">{tournament?.name}</h1>
            <p className="text-2xl capitalize mb-4 drop-shadow-md">{tournament?.sport} Tournament Registration</p>
            <div className="flex items-center justify-center gap-6 text-lg">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {new Date(tournament!.startDate).toLocaleDateString()} - {new Date(tournament!.endDate).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {tournament?.venue}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Tournament Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  {tournament?.name}
                </h2>
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(tournament!.startDate).toLocaleDateString()} - {new Date(tournament!.endDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {tournament?.venue}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {tournament?.currentParticipants || 0} registrations
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Badge className="bg-blue-100 text-blue-800">
                  {tournament?.sport}
                </Badge>
                {isRegistrationOpen() ? (
                  <Badge className="bg-green-100 text-green-800">
                    Registration Open
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    Registration Closed
                  </Badge>
                )}
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

            {tournament?.rules && (
              <div>
                <h3 className="font-semibold mb-2 text-gray-900">Rules & Regulations</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 whitespace-pre-line">{tournament.rules}</p>
                </div>
              </div>
            )}
          </div>

        {/* Registration Form */}
        {isRegistrationOpen() ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Form</h2>
              <p className="text-gray-600">
                Fill in your details to register for this tournament
              </p>
            </div>
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="selectedCategory" className="mb-2 block">Select Category *</Label>
                    <Select value={formData.selectedCategory} onValueChange={(value) => setFormData({ ...formData, selectedCategory: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your category" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournament?.categories?.map(category => (
                          <SelectItem key={category} value={category}>
                            {category === 'girls-under-13' ? 'Girls Under 13' :
                             category === 'boys-under-13' ? 'Boys Under 13' :
                             category === 'girls-under-18' ? 'Girls Under 18' :
                             category === 'boys-under-18' ? 'Boys Under 18' :
                             category === 'mens-single' ? 'Mens Single' :
                             category === 'womens-single' ? 'Womens Single' :
                             category === 'mens-doubles' ? 'Mens Doubles' :
                             category === 'mixed-doubles' ? 'Mixed Doubles' :
                             category === 'mens-team' ? 'Mens Team' :
                             category === 'womens-team' ? 'Womens Team' :
                             category === 'kids-team-u13' ? 'Kids Team (U13)' :
                             category === 'kids-team-u18' ? 'Kids Team (U18)' :
                             category === 'open-team' ? 'Open Team' : category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="expertiseLevel" className="mb-2 block">Playing Level *</Label>
                    <Select value={formData.expertiseLevel} onValueChange={(value) => setFormData({ ...formData, expertiseLevel: value })}>
                      <SelectTrigger>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="mb-2 block">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="mb-2 block">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="mb-2 block">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  {(tournament?.showEmergencyContact ?? true) && (
                    <div>
                      <Label htmlFor="emergencyContact" className="mb-2 block">Emergency Contact Number *</Label>
                      <Input
                        id="emergencyContact"
                        type="tel"
                        value={formData.emergencyContact}
                        onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="age" className="mb-2 block">Age *</Label>
                    <Input
                      id="age"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender" className="mb-2 block">Gender *</Label>
                    <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(tournament?.showTowerAndFlat ?? true) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tower" className="mb-2 block">Tower *</Label>
                      <Select value={formData.tower} onValueChange={(value) => setFormData({ ...formData, tower: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tower" />
                        </SelectTrigger>
                        <SelectContent>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'].map(tower => (
                            <SelectItem key={tower} value={tower}>Tower {tower}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="flatNumber" className="mb-2 block">Flat Number *</Label>
                      <Input
                        id="flatNumber"
                        value={formData.flatNumber}
                        onChange={(e) => setFormData({ ...formData, flatNumber: e.target.value })}
                        placeholder="e.g., 101, 201, 301"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Payment Section */}
                {tournament?.entryFee && tournament.entryFee > 0 && (
                  <div className="border-t pt-6 mt-6">
                    <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                      <h3 className="text-lg font-semibold text-yellow-900 mb-2">Payment Required</h3>
                      <p className="text-sm text-yellow-700">
                        Entry fee: <strong>₹{tournament.entryFee}</strong>. Please complete payment and provide reference number.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="paymentMethod" className="mb-2 block">Payment Method *</Label>
                        <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qr_code">QR Code</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="paymentReference" className="mb-2 block">Payment Reference Number *</Label>
                        <Input
                          id="paymentReference"
                          value={formData.paymentReference}
                          onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                          placeholder="Enter transaction/UPI reference number"
                          required
                        />
                      </div>

                      {formData.paymentMethod === 'qr_code' && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">QR Code Payment</h4>
                          <div className="text-center">
                            <div className="bg-white p-4 rounded-lg inline-block mb-2">
                              {/* QR Code placeholder - you can replace with actual QR code */}
                              <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                QR Code
                                <br />
                                ₹{tournament.entryFee}
                              </div>
                            </div>
                            <p className="text-sm text-blue-700">
                              Scan QR code and pay ₹{tournament.entryFee}
                            </p>
                          </div>
                        </div>
                      )}

                      {formData.paymentMethod === 'bank_transfer' && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h4 className="font-medium text-green-900 mb-2">Bank Transfer Details</h4>
                          <div className="text-sm text-green-700 space-y-1">
                            <p><strong>Account Name:</strong> Tournament Craft</p>
                            <p><strong>Account Number:</strong> 1234567890</p>
                            <p><strong>IFSC Code:</strong> SBIN0001234</p>
                            <p><strong>Amount:</strong> ₹{tournament.entryFee}</p>
                          </div>
                        </div>
                      )}

                      {formData.paymentMethod === 'cash' && (
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <h4 className="font-medium text-orange-900 mb-2">Cash Payment</h4>
                          <p className="text-sm text-orange-700">
                            Pay ₹{tournament.entryFee} in cash to the tournament organizers before the event.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="previousExperience" className="mb-2 block">Previous Experience (Optional)</Label>
                  <Textarea
                    id="previousExperience"
                    value={formData.previousExperience}
                    onChange={(e) => setFormData({ ...formData, previousExperience: e.target.value })}
                    rows={3}
                    placeholder="Describe your previous tournament experience, achievements, etc."
                  />
                </div>

                {(tournament?.showIsResident ?? true) && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isResident"
                      checked={formData.isResident}
                      onChange={(e) => setFormData({ ...formData, isResident: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="isResident" className="mb-0">I am a local resident</Label>
                  </div>
                )}

                {/* Partner Details Section - Only show for doubles tournaments */}
                {(formData.selectedCategory === 'mens-doubles' || formData.selectedCategory === 'mixed-doubles') && (
                  <div className="border-t pt-6 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Partner Details Required</h3>
                      <p className="text-sm text-blue-700">
                        This is a doubles tournament. Please provide your partner&apos;s details below.
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Partner Basic Info */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Partner Information</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="partnerName" className="mb-2 block">Partner Name *</Label>
                            <Input
                              id="partnerName"
                              value={formData.partnerName}
                              onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
                              placeholder="Partner's full name"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="partnerPhone" className="mb-2 block">Partner Phone *</Label>
                            <Input
                              id="partnerPhone"
                              type="tel"
                              value={formData.partnerPhone}
                              onChange={(e) => setFormData({ ...formData, partnerPhone: e.target.value })}
                              placeholder="Partner's phone number"
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <Label htmlFor="partnerEmail" className="mb-2 block">Partner Email *</Label>
                          <Input
                            id="partnerEmail"
                            type="email"
                            value={formData.partnerEmail}
                            onChange={(e) => setFormData({ ...formData, partnerEmail: e.target.value })}
                            placeholder="Partner's email address"
                            required
                          />
                        </div>

                        {(tournament?.showTowerAndFlat ?? true) && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                              <div>
                                <Label htmlFor="partnerTower" className="mb-2 block">Partner Tower *</Label>
                                <Select value={formData.partnerTower} onValueChange={(value) => setFormData({ ...formData, partnerTower: value })}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select partner's tower" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'].map(tower => (
                                      <SelectItem key={tower} value={tower}>Tower {tower}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="partnerFlatNumber" className="mb-2 block">Partner Flat Number *</Label>
                                <Input
                                  id="partnerFlatNumber"
                                  value={formData.partnerFlatNumber}
                                  onChange={(e) => setFormData({ ...formData, partnerFlatNumber: e.target.value })}
                                  placeholder="e.g., 101, 201, 301"
                                  required
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Link href="/">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Registering...' : 'Register'}
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
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
