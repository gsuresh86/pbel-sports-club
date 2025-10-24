'use client';

import { useState } from 'react';
import { PublicLayout } from '@/components/PublicLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, Trophy } from 'lucide-react';

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    sport: '',
    name: '',
    email: '',
    phone: '',
  });

  const sports = [
    { value: 'badminton', label: 'Badminton', icon: '🏸' },
    { value: 'table-tennis', label: 'Table Tennis', icon: '🏓' },
    { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
    { value: 'tennis', label: 'Tennis', icon: '🎾' },
    { value: 'basketball', label: 'Basketball', icon: '🏀' },
    { value: 'football', label: 'Football', icon: '⚽' },
    { value: 'cricket', label: 'Cricket', icon: '🏏' },
    { value: 'other', label: 'Other Sport', icon: '🏆' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Save to tournamentLeads collection
      await addDoc(collection(db, 'tournamentLeads'), {
        ...formData,
        registeredAt: new Date(),
        status: 'new',
      });

      setSuccess(true);
      setFormData({
        sport: '',
        name: '',
        email: '',
        phone: '',
      });
    } catch (error) {
      console.error('Error submitting registration:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <PublicLayout>
        <div className="min-h-screen backdrop-blur-sm py-12 px-4">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-white/20">
              <CardContent className="p-12 text-center">
                <div className="mb-8">
                  <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Thank You for Your Interest!
                  </h1>
                  <p className="text-xl text-gray-600 mb-8">
                    We&apos;ve received your tournament registration request.
                  </p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">What happens next?</h3>
                  <div className="space-y-3 text-left">
                    <div className="flex items-center text-blue-800">
                      <Trophy className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span>Our team will review your registration within 24-48 hours</span>
                    </div>
                    <div className="flex items-center text-blue-800">
                      <Trophy className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span>We&apos;ll contact you with tournament details and next steps</span>
                    </div>
                    <div className="flex items-center text-blue-800">
                      <Trophy className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span>Get ready to compete in an amazing tournament!</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center flex-col sm:flex-row">
                  <Button 
                    onClick={() => setSuccess(false)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Register Another Person
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/tournament'}
                  >
                    View Tournaments
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
      <div className="min-h-screen backdrop-blur-sm py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-white/20">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="bg-blue-100 rounded-full p-3 mr-3">
                  <Trophy className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-3xl">Tournament Registration</CardTitle>
              </div>
              <CardDescription className="text-center text-base">
                Register your interest to participate in upcoming tournaments. We&apos;ll contact you with more details!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sport">Select Sport *</Label>
                  <Select
                    value={formData.sport}
                    onValueChange={(value) => setFormData({ ...formData, sport: value })}
                    required
                  >
                    <SelectTrigger className="bg-white/70 border-gray-200 focus:border-blue-500">
                      <SelectValue placeholder="Choose your sport" />
                    </SelectTrigger>
                    <SelectContent>
                      {sports.map((sport) => (
                        <SelectItem key={sport.value} value={sport.value}>
                          {sport.icon} {sport.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your full name"
                    className="bg-white/70 border-gray-200 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your.email@example.com"
                    className="bg-white/70 border-gray-200 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 1234567890"
                    className="bg-white/70 border-gray-200 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This is an interest registration. Our team will reach out to you 
                    with tournament details, schedules, and registration requirements.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300" 
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Register Your Interest'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
