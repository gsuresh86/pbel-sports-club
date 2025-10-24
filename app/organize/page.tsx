'use client';

import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  Clock, 
  CheckCircle, 
  Star,
  Shield,
  Zap,
  Target,
  Building,
  Phone,
  Mail,
  Globe,
  Award
} from 'lucide-react';

interface OrganizerRegistration {
  // Organizer Details
  organizerName: string;
  organizationName: string;
  email: string;
  phone: string;
  website?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  
  // Tournament Details
  tournamentName: string;
  sport: string;
  tournamentType: string;
  description: string;
  expectedParticipants: number;
  entryFee: number;
  prizeMoney: number;
  
  // Event Details
  eventDate: string;
  eventTime: string;
  venue: string;
  venueAddress: string;
  venueCapacity: number;
  
  // Requirements
  equipmentNeeded: string[];
  staffRequired: number;
  budget: number;
  sponsorshipNeeded: boolean;
  mediaCoverage: boolean;
  
  // Additional Services
  servicesNeeded: string[];
  specialRequirements: string;
  
  // Contact Preferences
  preferredContactMethod: string;
  bestTimeToContact: string;
  urgency: string;
  
  // Terms and Conditions
  agreeToTerms: boolean;
  agreeToMarketing: boolean;
  
  // Metadata
  submittedAt: Date;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
}

export default function OrganizerRegistrationPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OrganizerRegistration>({
    organizerName: '',
    organizationName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    tournamentName: '',
    sport: '',
    tournamentType: '',
    description: '',
    expectedParticipants: 0,
    entryFee: 0,
    prizeMoney: 0,
    eventDate: '',
    eventTime: '',
    venue: '',
    venueAddress: '',
    venueCapacity: 0,
    equipmentNeeded: [],
    staffRequired: 0,
    budget: 0,
    sponsorshipNeeded: false,
    mediaCoverage: false,
    servicesNeeded: [],
    specialRequirements: '',
    preferredContactMethod: 'email',
    bestTimeToContact: 'morning',
    urgency: 'normal',
    agreeToTerms: false,
    agreeToMarketing: false,
    submittedAt: new Date(),
    status: 'pending'
  });

  const sports = [
    { value: 'badminton', label: 'Badminton', icon: '🏸' },
    { value: 'table-tennis', label: 'Table Tennis', icon: '🏓' },
    { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
    { value: 'tennis', label: 'Tennis', icon: '🎾' },
    { value: 'basketball', label: 'Basketball', icon: '🏀' },
    { value: 'football', label: 'Football', icon: '⚽' },
    { value: 'cricket', label: 'Cricket', icon: '🏏' },
    { value: 'other', label: 'Other', icon: '🏆' }
  ];

  const tournamentTypes = [
    'Single Elimination',
    'Double Elimination', 
    'Round Robin',
    'Swiss System',
    'League Format',
    'Knockout Tournament',
    'Mixed Format'
  ];

  const equipmentOptions = [
    'Badminton Courts',
    'Table Tennis Tables',
    'Volleyball Courts',
    'Tennis Courts',
    'Basketball Courts',
    'Football Fields',
    'Cricket Grounds',
    'Scoreboards',
    'Timing Systems',
    'Sound System',
    'Lighting',
    'Seating Arrangements',
    'Refreshment Facilities',
    'Medical Support',
    'Security Services'
  ];

  const serviceOptions = [
    'Tournament Management Software',
    'Live Scoring System',
    'Bracket Generation',
    'Participant Registration',
    'Payment Processing',
    'Marketing & Promotion',
    'Photography & Videography',
    'Trophy & Medals',
    'Certificates',
    'Refreshments',
    'Transportation',
    'Accommodation',
    'Insurance Coverage',
    'Legal Documentation',
    'Sponsorship Management'
  ];

  const handleInputChange = (field: keyof OrganizerRegistration, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayChange = (field: keyof OrganizerRegistration, value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...(prev[field] as string[]), value]
        : (prev[field] as string[]).filter(item => item !== value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'organizerRegistrations'), {
        ...formData,
        submittedAt: new Date()
      });
      
      setSuccess(true);
    } catch (err) {
      console.error('Error submitting registration:', err);
      setError('Failed to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (success) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-white/90 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardContent className="p-12 text-center">
                <div className="mb-8">
                  <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Registration Submitted Successfully!
                  </h1>
                  <p className="text-xl text-gray-600 mb-8">
                    Thank you for your interest in organizing tournaments with Tournament Craft.
                  </p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">What happens next?</h3>
                  <div className="space-y-3 text-left">
                    <div className="flex items-center text-green-800">
                      <Clock className="h-5 w-5 mr-3" />
                      <span>We'll review your tournament proposal within 24-48 hours</span>
                    </div>
                    <div className="flex items-center text-green-800">
                      <Phone className="h-5 w-5 mr-3" />
                      <span>Our team will contact you via your preferred method</span>
                    </div>
                    <div className="flex items-center text-green-800">
                      <Trophy className="h-5 w-5 mr-3" />
                      <span>We'll discuss tournament details and provide a customized quote</span>
                    </div>
                    <div className="flex items-center text-green-800">
                      <Star className="h-5 w-5 mr-3" />
                      <span>Get ready to host an amazing tournament!</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <a href="/tournament">View Existing Tournaments</a>
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Submit Another Proposal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-white/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-blue-100 rounded-full p-4 mr-4">
                <Trophy className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Organize Your Tournament
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Ready to host an amazing sports tournament? Let Tournament Craft help you create an unforgettable event with our professional tournament management services.
            </p>
            
            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-white/20">
                <Shield className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Professional Management</h3>
                <p className="text-sm text-gray-600">Complete tournament management from registration to awards</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-white/20">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Live Scoring & Updates</h3>
                <p className="text-sm text-gray-600">Real-time scoring and live updates for participants</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-white/20">
                <Target className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Custom Solutions</h3>
                <p className="text-sm text-gray-600">Tailored packages for your specific tournament needs</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    currentStep >= step 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 4 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-600">
              <span>Organizer Info</span>
              <span>Tournament Details</span>
              <span>Event Planning</span>
              <span>Review & Submit</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl text-center">
                  {currentStep === 1 && 'Organizer Information'}
                  {currentStep === 2 && 'Tournament Details'}
                  {currentStep === 3 && 'Event Planning & Requirements'}
                  {currentStep === 4 && 'Review & Submit'}
                </CardTitle>
                <CardDescription className="text-center">
                  {currentStep === 1 && 'Tell us about yourself and your organization'}
                  {currentStep === 2 && 'Describe your tournament and sport'}
                  {currentStep === 3 && 'Specify your event needs and requirements'}
                  {currentStep === 4 && 'Review your information and submit your proposal'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-8">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {/* Step 1: Organizer Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="organizerName">Full Name *</Label>
                        <Input
                          id="organizerName"
                          value={formData.organizerName}
                          onChange={(e) => handleInputChange('organizerName', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="organizationName">Organization Name *</Label>
                        <Input
                          id="organizationName"
                          value={formData.organizationName}
                          onChange={(e) => handleInputChange('organizationName', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="website">Website (Optional)</Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleInputChange('website', e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="bg-white/70 border-gray-200 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address">Address *</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        required
                        className="bg-white/70 border-gray-200 focus:border-blue-500"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          value={formData.pincode}
                          onChange={(e) => handleInputChange('pincode', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Tournament Details */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="tournamentName">Tournament Name *</Label>
                        <Input
                          id="tournamentName"
                          value={formData.tournamentName}
                          onChange={(e) => handleInputChange('tournamentName', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sport">Sport *</Label>
                        <Select value={formData.sport} onValueChange={(value) => handleInputChange('sport', value)}>
                          <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                            <SelectValue placeholder="Select a sport" />
                          </SelectTrigger>
                          <SelectContent>
                            {sports.map(sport => (
                              <SelectItem key={sport.value} value={sport.value}>
                                {sport.icon} {sport.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="tournamentType">Tournament Type *</Label>
                      <Select value={formData.tournamentType} onValueChange={(value) => handleInputChange('tournamentType', value)}>
                        <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                          <SelectValue placeholder="Select tournament format" />
                        </SelectTrigger>
                        <SelectContent>
                          {tournamentTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Tournament Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        required
                        className="bg-white/70 border-gray-200 focus:border-blue-500"
                        rows={4}
                        placeholder="Describe your tournament, its purpose, and what makes it special..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="expectedParticipants">Expected Participants *</Label>
                        <Input
                          id="expectedParticipants"
                          type="number"
                          min="1"
                          value={formData.expectedParticipants}
                          onChange={(e) => handleInputChange('expectedParticipants', parseInt(e.target.value) || 0)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="entryFee">Entry Fee (₹) *</Label>
                        <Input
                          id="entryFee"
                          type="number"
                          min="0"
                          value={formData.entryFee}
                          onChange={(e) => handleInputChange('entryFee', parseInt(e.target.value) || 0)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prizeMoney">Prize Money (₹) *</Label>
                        <Input
                          id="prizeMoney"
                          type="number"
                          min="0"
                          value={formData.prizeMoney}
                          onChange={(e) => handleInputChange('prizeMoney', parseInt(e.target.value) || 0)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Event Planning */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="eventDate">Event Date *</Label>
                        <Input
                          id="eventDate"
                          type="date"
                          value={formData.eventDate}
                          onChange={(e) => handleInputChange('eventDate', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="eventTime">Event Time *</Label>
                        <Input
                          id="eventTime"
                          type="time"
                          value={formData.eventTime}
                          onChange={(e) => handleInputChange('eventTime', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="venue">Venue Name *</Label>
                        <Input
                          id="venue"
                          value={formData.venue}
                          onChange={(e) => handleInputChange('venue', e.target.value)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="venueCapacity">Venue Capacity *</Label>
                        <Input
                          id="venueCapacity"
                          type="number"
                          min="1"
                          value={formData.venueCapacity}
                          onChange={(e) => handleInputChange('venueCapacity', parseInt(e.target.value) || 0)}
                          required
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="venueAddress">Venue Address *</Label>
                      <Textarea
                        id="venueAddress"
                        value={formData.venueAddress}
                        onChange={(e) => handleInputChange('venueAddress', e.target.value)}
                        required
                        className="bg-white/70 border-gray-200 focus:border-blue-500"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label className="text-base font-semibold">Equipment & Services Needed</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        {equipmentOptions.map(equipment => (
                          <div key={equipment} className="flex items-center space-x-2">
                            <Checkbox
                              id={equipment}
                              checked={formData.equipmentNeeded.includes(equipment)}
                              onCheckedChange={(checked) => 
                                handleArrayChange('equipmentNeeded', equipment, checked as boolean)
                              }
                            />
                            <Label htmlFor={equipment} className="text-sm">
                              {equipment}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-base font-semibold">Additional Services</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        {serviceOptions.map(service => (
                          <div key={service} className="flex items-center space-x-2">
                            <Checkbox
                              id={service}
                              checked={formData.servicesNeeded.includes(service)}
                              onCheckedChange={(checked) => 
                                handleArrayChange('servicesNeeded', service, checked as boolean)
                              }
                            />
                            <Label htmlFor={service} className="text-sm">
                              {service}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="staffRequired">Staff Required</Label>
                        <Input
                          id="staffRequired"
                          type="number"
                          min="0"
                          value={formData.staffRequired}
                          onChange={(e) => handleInputChange('staffRequired', parseInt(e.target.value) || 0)}
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="budget">Budget (₹)</Label>
                        <Input
                          id="budget"
                          type="number"
                          min="0"
                          value={formData.budget}
                          onChange={(e) => handleInputChange('budget', parseInt(e.target.value) || 0)}
                          className="bg-white/70 border-gray-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="sponsorshipNeeded"
                          checked={formData.sponsorshipNeeded}
                          onCheckedChange={(checked) => handleInputChange('sponsorshipNeeded', checked)}
                        />
                        <Label htmlFor="sponsorshipNeeded">Need sponsorship support</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mediaCoverage"
                          checked={formData.mediaCoverage}
                          onCheckedChange={(checked) => handleInputChange('mediaCoverage', checked)}
                        />
                        <Label htmlFor="mediaCoverage">Require media coverage</Label>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="specialRequirements">Special Requirements</Label>
                      <Textarea
                        id="specialRequirements"
                        value={formData.specialRequirements}
                        onChange={(e) => handleInputChange('specialRequirements', e.target.value)}
                        className="bg-white/70 border-gray-200 focus:border-blue-500"
                        rows={3}
                        placeholder="Any special requirements or requests..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                        <Select value={formData.preferredContactMethod} onValueChange={(value) => handleInputChange('preferredContactMethod', value)}>
                          <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone Call</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="video_call">Video Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="bestTimeToContact">Best Time to Contact</Label>
                        <Select value={formData.bestTimeToContact} onValueChange={(value) => handleInputChange('bestTimeToContact', value)}>
                          <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                            <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                            <SelectItem value="evening">Evening (5 PM - 8 PM)</SelectItem>
                            <SelectItem value="anytime">Anytime</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="urgency">Urgency Level</Label>
                        <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
                          <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low - Planning ahead</SelectItem>
                            <SelectItem value="normal">Normal - Within 2-3 months</SelectItem>
                            <SelectItem value="high">High - Within 1 month</SelectItem>
                            <SelectItem value="urgent">Urgent - Within 2 weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Review & Submit */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4">Review Your Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-blue-800 mb-2">Organizer Details</h4>
                          <div className="text-sm text-blue-700 space-y-1">
                            <p><strong>Name:</strong> {formData.organizerName}</p>
                            <p><strong>Organization:</strong> {formData.organizationName}</p>
                            <p><strong>Email:</strong> {formData.email}</p>
                            <p><strong>Phone:</strong> {formData.phone}</p>
                            <p><strong>Location:</strong> {formData.city}, {formData.state}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-blue-800 mb-2">Tournament Details</h4>
                          <div className="text-sm text-blue-700 space-y-1">
                            <p><strong>Tournament:</strong> {formData.tournamentName}</p>
                            <p><strong>Sport:</strong> {formData.sport}</p>
                            <p><strong>Type:</strong> {formData.tournamentType}</p>
                            <p><strong>Participants:</strong> {formData.expectedParticipants}</p>
                            <p><strong>Entry Fee:</strong> ₹{formData.entryFee}</p>
                            <p><strong>Prize Money:</strong> ₹{formData.prizeMoney}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="font-medium text-blue-800 mb-2">Event Information</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p><strong>Date:</strong> {formData.eventDate}</p>
                          <p><strong>Time:</strong> {formData.eventTime}</p>
                          <p><strong>Venue:</strong> {formData.venue}</p>
                          <p><strong>Capacity:</strong> {formData.venueCapacity} people</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agreeToTerms"
                          checked={formData.agreeToTerms}
                          onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked)}
                          required
                        />
                        <Label htmlFor="agreeToTerms" className="text-sm">
                          I agree to the terms and conditions and understand that this is a proposal that will be reviewed by Tournament Craft team.
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="agreeToMarketing"
                          checked={formData.agreeToMarketing}
                          onCheckedChange={(checked) => handleInputChange('agreeToMarketing', checked)}
                        />
                        <Label htmlFor="agreeToMarketing" className="text-sm">
                          I agree to receive updates and promotional materials from Tournament Craft.
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Previous
                  </Button>
                  
                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={submitting || !formData.agreeToTerms}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {submitting ? 'Submitting...' : 'Submit Proposal'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
