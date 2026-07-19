'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Tournament, SportType, TournamentType, CategoryType, PaymentAccount, TournamentContact } from '@/types';
import { ImageUpload } from '@/components/ui/image-upload';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { updateTournament } from '@/lib/tournament-api';
import {
  buildTournamentContactsPayload,
  getTournamentContacts,
  normalizeTournamentContactsForForm,
} from '@/lib/utils';
import { Plus, ScrollText, X, MessageCircle, DollarSign, ExternalLink } from 'lucide-react';

const sports = [
  { value: 'badminton', label: 'Badminton', icon: '🏸' },
  { value: 'table-tennis', label: 'Table Tennis', icon: '🏓' },
  { value: 'volleyball', label: 'Volleyball', icon: '🏐' },
  { value: 'tennis', label: 'Tennis', icon: '🎾' },
  { value: 'basketball', label: 'Basketball', icon: '🏀' },
  { value: 'football', label: 'Football', icon: '⚽' },
  { value: 'cricket', label: 'Cricket', icon: '🏏' },
  { value: 'throw-ball', label: 'Throw Ball', icon: '🏐' },
  { value: 'other', label: 'Other Sport', icon: '🏆' },
];

type TournamentFormData = {
  name: string;
  sport: SportType;
  tournamentType: TournamentType;
  categories: CategoryType[];
  startDate: string;
  endDate: string;
  venue: string;
  description: string;
  registrationDeadline: string;
  maxParticipants: string;
  entryFee: string;
  prizePool: string;
  rules: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registrationOpen: boolean;
  banner: string;
  showRegistrationTitle: boolean;
  isPublic: boolean;
  matchFormat: 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30';
  showTowerAndFlat: boolean;
  showEmergencyContact: boolean;
  showIsResident: boolean;
  showTshirtSize: boolean;
  showVolunteerNomination: boolean;
  paymentQrCode: string;
  whatsappGroupLink: string;
  contacts: TournamentContact[];
  doublesFee: string;
  repeatFee: string;
  limitRegistrationsPerParticipant: boolean;
  maxRegistrationsPerParticipant: string;
  paymentAccounts: PaymentAccount[];
};

const emptyFormData = (): TournamentFormData => ({
  name: '',
  sport: 'badminton',
  tournamentType: 'individual',
  categories: [],
  startDate: '',
  endDate: '',
  venue: '',
  description: '',
  registrationDeadline: '',
  maxParticipants: '',
  entryFee: '',
  prizePool: '',
  rules: '',
  status: 'upcoming',
  registrationOpen: true,
  banner: '',
  showRegistrationTitle: true,
  isPublic: true,
  matchFormat: 'best-of-3',
  showTowerAndFlat: true,
  showEmergencyContact: true,
  showIsResident: true,
  showTshirtSize: false,
  showVolunteerNomination: false,
  paymentQrCode: '',
  whatsappGroupLink: '',
  contacts: [
    { name: '', phone: '' },
    { name: '', phone: '' },
  ],
  doublesFee: '700',
  repeatFee: '300',
  limitRegistrationsPerParticipant: true,
  maxRegistrationsPerParticipant: '3',
  paymentAccounts: [],
});

function tournamentToFormData(tournament: Tournament): TournamentFormData {
  return {
    name: tournament.name,
    sport: tournament.sport,
    tournamentType: tournament.tournamentType || 'individual',
    categories: tournament.categories || [],
    startDate: new Date(tournament.startDate).toISOString().split('T')[0],
    endDate: new Date(tournament.endDate).toISOString().split('T')[0],
    venue: tournament.venue,
    description: tournament.description,
    registrationDeadline: new Date(tournament.registrationDeadline).toISOString().split('T')[0],
    maxParticipants: tournament.maxParticipants?.toString() || '',
    entryFee: tournament.entryFee?.toString() || '',
    prizePool: tournament.prizePool?.toString() || '',
    rules: tournament.rules || '',
    status: tournament.status,
    registrationOpen: tournament.registrationOpen ?? true,
    banner: tournament.banner || '',
    showRegistrationTitle: tournament.showRegistrationTitle ?? true,
    isPublic: (tournament as Tournament & { isPublic?: boolean }).isPublic !== undefined
      ? Boolean((tournament as Tournament & { isPublic?: boolean }).isPublic)
      : true,
    matchFormat: tournament.matchFormat || 'best-of-3',
    showTowerAndFlat: tournament.showTowerAndFlat ?? true,
    showEmergencyContact: tournament.showEmergencyContact ?? true,
    showIsResident: tournament.showIsResident ?? true,
    showTshirtSize: tournament.showTshirtSize ?? false,
    showVolunteerNomination: tournament.showVolunteerNomination ?? false,
    paymentQrCode: tournament.paymentQrCode || '',
    whatsappGroupLink: tournament.whatsappGroupLink || '',
    contacts: normalizeTournamentContactsForForm(getTournamentContacts(tournament)),
    doublesFee: tournament.doublesFee?.toString() || '700',
    repeatFee: tournament.repeatFee?.toString() || '300',
    limitRegistrationsPerParticipant: tournament.limitRegistrationsPerParticipant ?? true,
    maxRegistrationsPerParticipant: tournament.maxRegistrationsPerParticipant?.toString() || '3',
    paymentAccounts: tournament.paymentAccounts || [],
  };
}

function renderInline(text: string): React.ReactNode {
  const INLINE = /(\*{3}[^*]+\*{3}|\*{2}[^*]+\*{2}|\*[^*]+\*)/g;
  const parts = text.split(INLINE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('***') && part.endsWith('***'))
          return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 3)
          return <em key={i}>{part.slice(1, -1)}</em>;
        return part || null;
      })}
    </>
  );
}

function RulesPreview({ rules }: { rules: string }) {
  const lines = rules.split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuf: string[] = [];
  let numBuf: string[] = [];
  let numStart = 1;
  let key = 0;

  const flush = () => {
    if (bulletBuf.length) {
      elements.push(
        <ul key={key++} className="list-disc list-outside ml-5 space-y-0.5 my-1.5">
          {bulletBuf.map((t, i) => <li key={i} className="text-gray-700 text-sm">{renderInline(t)}</li>)}
        </ul>
      );
      bulletBuf = [];
    }
    if (numBuf.length) {
      elements.push(
        <ol key={key++} start={numStart} className="list-decimal list-outside ml-5 space-y-0.5 my-1.5">
          {numBuf.map((t, i) => <li key={i} className="text-gray-700 text-sm">{renderInline(t)}</li>)}
        </ol>
      );
      numBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); elements.push(<div key={key++} className="h-2" />); continue; }
    if (line.startsWith('## ')) { flush(); elements.push(<h3 key={key++} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{renderInline(line.slice(3))}</h3>); continue; }
    if (line.startsWith('# '))  { flush(); elements.push(<h2 key={key++} className="text-base font-bold text-gray-900 mt-4 mb-1 pb-1 border-b border-gray-200 first:mt-0">{renderInline(line.slice(2))}</h2>); continue; }
    const bm = line.match(/^[-•]\s+(.+)/);
    if (bm) { if (numBuf.length) flush(); bulletBuf.push(bm[1]); continue; }
    const nm = line.match(/^(\d+)[.)]\s+(.+)/);
    if (nm) { if (bulletBuf.length) flush(); if (!numBuf.length) numStart = parseInt(nm[1]); numBuf.push(nm[2]); continue; }
    flush();
    elements.push(<p key={key++} className="text-gray-700 text-sm leading-relaxed">{renderInline(line)}</p>);
  }
  flush();

  return <div className="space-y-0.5">{elements}</div>;
}

export type TournamentFormDrawerSaveInfo = {
  id: string;
  mode: 'create' | 'edit' | 'rules';
};

export interface TournamentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, drawer is in edit mode; when null/undefined, create mode. */
  tournament?: Tournament | null;
  onSaved?: (info: TournamentFormDrawerSaveInfo) => void;
}

export function TournamentFormDrawer({
  open,
  onOpenChange,
  tournament = null,
  onSaved,
}: TournamentFormDrawerProps) {
  const { user } = useAuth();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const editingTournament = tournament ?? null;

  const [formData, setFormData] = useState<TournamentFormData>(emptyFormData);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState(false);
  const [rulesEditingTournament, setRulesEditingTournament] = useState<Tournament | null>(null);
  const [rulesContent, setRulesContent] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const rulesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastHydratedKeyRef.current = null;
      setRulesDrawerOpen(false);
      return;
    }
    const key = editingTournament ? `edit:${editingTournament.id}` : 'create';
    if (lastHydratedKeyRef.current === key) return;
    lastHydratedKeyRef.current = key;
    setFormData(editingTournament ? tournamentToFormData(editingTournament) : emptyFormData());
  }, [open, editingTournament]);

  const wrapSelection = (marker: string) => {
    const el = rulesTextareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const before = value.slice(0, s);
    const after = value.slice(e);

    let newValue: string;
    let newS: number;
    let newE: number;

    if (selected) {
      if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
        const inner = selected.slice(marker.length, selected.length - marker.length);
        newValue = before + inner + after;
        newS = s;
        newE = s + inner.length;
      } else {
        newValue = before + marker + selected + marker + after;
        newS = s + marker.length;
        newE = e + marker.length;
      }
    } else {
      const placeholder = marker === '**' ? 'bold text' : marker === '***' ? 'bold italic' : 'italic text';
      newValue = before + marker + placeholder + marker + after;
      newS = s + marker.length;
      newE = s + marker.length + placeholder.length;
    }

    setRulesContent(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newS, newE);
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setRulesDrawerOpen(false);
      setFormData(emptyFormData());
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tournamentData: Partial<Tournament> = {
        name: formData.name,
        sport: formData.sport,
        tournamentType: formData.tournamentType,
        categories: formData.categories,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        venue: formData.venue,
        description: formData.description,
        registrationDeadline: new Date(formData.registrationDeadline),
        currentParticipants: 0,
        rules: formData.rules,
        status: formData.status,
        registrationOpen: formData.registrationOpen,
        isPublic: formData.isPublic,
        showRegistrationTitle: formData.showRegistrationTitle,
        ...(!editingTournament && { matchFormat: formData.matchFormat }),
        showTowerAndFlat: formData.showTowerAndFlat,
        showEmergencyContact: formData.showEmergencyContact,
        showIsResident: formData.showIsResident,
        showTshirtSize: formData.showTshirtSize,
        showVolunteerNomination: formData.showVolunteerNomination,
        updatedAt: new Date(),
        createdBy: user?.id,
      };

      if (formData.maxParticipants && formData.maxParticipants.trim() !== '') {
        tournamentData.maxParticipants = parseInt(formData.maxParticipants);
      }
      if (formData.entryFee && formData.entryFee.trim() !== '') {
        tournamentData.entryFee = parseFloat(formData.entryFee);
      }
      if (formData.prizePool && formData.prizePool.trim() !== '') {
        tournamentData.prizePool = parseFloat(formData.prizePool);
      }
      if (formData.banner && formData.banner.trim() !== '') {
        tournamentData.banner = formData.banner;
      }
      if (formData.paymentQrCode && formData.paymentQrCode.trim() !== '') {
        tournamentData.paymentQrCode = formData.paymentQrCode;
      } else {
        tournamentData.paymentQrCode = null as unknown as string;
      }
      if (formData.whatsappGroupLink && formData.whatsappGroupLink.trim() !== '') {
        tournamentData.whatsappGroupLink = formData.whatsappGroupLink.trim();
      } else {
        tournamentData.whatsappGroupLink = null as unknown as string;
      }
      const contactsPayload = buildTournamentContactsPayload(formData.contacts);
      if (contactsPayload) {
        tournamentData.contacts = contactsPayload;
      } else {
        tournamentData.contacts = null as unknown as TournamentContact[];
      }
      tournamentData.contactName = null as unknown as string;
      tournamentData.contactPhone = null as unknown as string;
      if (formData.doublesFee && formData.doublesFee.trim() !== '') {
        tournamentData.doublesFee = parseFloat(formData.doublesFee);
      }
      if (formData.repeatFee && formData.repeatFee.trim() !== '') {
        tournamentData.repeatFee = parseFloat(formData.repeatFee);
      }
      tournamentData.limitRegistrationsPerParticipant = formData.limitRegistrationsPerParticipant;
      if (
        formData.limitRegistrationsPerParticipant &&
        formData.maxRegistrationsPerParticipant &&
        formData.maxRegistrationsPerParticipant.trim() !== ''
      ) {
        tournamentData.maxRegistrationsPerParticipant = Math.max(
          1,
          parseInt(formData.maxRegistrationsPerParticipant, 10)
        );
      }
      tournamentData.paymentAccounts = formData.paymentAccounts.filter(a => a.name.trim() && a.number.trim());

      if (editingTournament) {
        await updateTournament(editingTournament.id, {
          ...tournamentData,
          updatedAt: new Date(),
        });
        handleOpenChange(false);
        onSaved?.({ id: editingTournament.id, mode: 'edit' });
      } else {
        const docRef = await addDoc(collection(db, 'tournaments'), {
          ...tournamentData,
          createdAt: new Date(),
        });

        try {
          const { notifyAdminsNewTournament } = await import('@/lib/notification-utils');
          await notifyAdminsNewTournament(formData.name, docRef.id);
        } catch (error) {
          console.error('Error sending notification:', error);
        }

        handleOpenChange(false);
        onSaved?.({ id: docRef.id, mode: 'create' });
      }
    } catch (error) {
      console.error('Error saving tournament:', error);
      alert({
        title: 'Error',
        description: 'Failed to save tournament. Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRules = async () => {
    if (!rulesEditingTournament) return;
    setRulesSaving(true);
    try {
      await updateDoc(doc(db, 'tournaments', rulesEditingTournament.id), {
        rules: rulesContent,
        updatedAt: new Date(),
      });
      setFormData(prev => ({ ...prev, rules: rulesContent }));
      setRulesDrawerOpen(false);
      alert({ title: 'Saved', description: 'Tournament rules updated successfully.', variant: 'success' });
      onSaved?.({ id: rulesEditingTournament.id, mode: 'rules' });
    } catch {
      alert({ title: 'Error', description: 'Failed to save rules. Please try again.', variant: 'error' });
    } finally {
      setRulesSaving(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent side="right" className="max-w-2xl">
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle>{editingTournament ? 'Edit Tournament' : 'Create Tournament'}</DrawerTitle>
            <DrawerDescription>
              {editingTournament ? 'Update tournament details and settings' : 'Create a new tournament'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sport">Sport</Label>
                  <Select value={formData.sport} onValueChange={(value: SportType) => {
                    const newFormData = { ...formData, sport: value };
                    if (value === 'volleyball' || value === 'throw-ball') {
                      newFormData.tournamentType = 'team';
                    }
                    setFormData(newFormData);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sport" />
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
                  <Label htmlFor="tournamentType">Tournament Type</Label>
                  <Select
                    value={formData.tournamentType}
                    onValueChange={(value: TournamentType) => setFormData({ ...formData, tournamentType: value })}
                    disabled={formData.sport === 'volleyball' || formData.sport === 'throw-ball'}
                  >
                    <SelectTrigger className={formData.sport === 'volleyball' || formData.sport === 'throw-ball' ? 'opacity-50' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <p className="text-sm text-gray-600">Select tournament categories</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {[
                    'girls-under-13', 'boys-under-13', 'girls-under-18', 'boys-under-18',
                    'mens-single', 'womens-single', 'mens-doubles', 'womens-doubles', 'mixed-doubles', 'family-doubles',
                    'mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team',
                  ].map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={formData.categories.includes(category as CategoryType)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              categories: [...formData.categories, category as CategoryType],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              categories: formData.categories.filter(cat => cat !== category),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm capitalize">
                        {category.replace(/-/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DatePickerInput
                  id="startDate"
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(startDate) => setFormData({ ...formData, startDate })}
                  required
                />
                <DatePickerInput
                  id="endDate"
                  label="End Date"
                  value={formData.endDate}
                  onChange={(endDate) => setFormData({ ...formData, endDate })}
                  required
                />
                <DatePickerInput
                  id="registrationDeadline"
                  label="Registration Deadline"
                  value={formData.registrationDeadline}
                  onChange={(registrationDeadline) => setFormData({ ...formData, registrationDeadline })}
                  required
                />
                <div className="space-y-2">
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                  <div className="space-y-2">
                    <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                    <Input
                      id="entryFee"
                      type="number"
                      value={formData.entryFee}
                      onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doublesFee">Doubles Fee (₹ per person)</Label>
                    <Input
                      id="doublesFee"
                      type="number"
                      min="0"
                      placeholder="700"
                      value={formData.doublesFee}
                      onChange={(e) => setFormData({ ...formData, doublesFee: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Fee per player for doubles categories</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repeatFee">Repeat Registration Fee (₹)</Label>
                    <Input
                      id="repeatFee"
                      type="number"
                      min="0"
                      placeholder="300"
                      value={formData.repeatFee}
                      onChange={(e) => setFormData({ ...formData, repeatFee: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">Discounted fee for an additional category</p>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="limitRegistrationsPerParticipant"
                      checked={formData.limitRegistrationsPerParticipant}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        limitRegistrationsPerParticipant: checked === true,
                      })}
                    />
                    <Label htmlFor="limitRegistrationsPerParticipant">
                      Limit Categories per Participant
                    </Label>
                    {formData.limitRegistrationsPerParticipant && (
                      <Input
                        id="maxRegistrationsPerParticipant"
                        type="number"
                        min="1"
                        placeholder="3"
                        value={formData.maxRegistrationsPerParticipant}
                        onChange={(e) => setFormData({ ...formData, maxRegistrationsPerParticipant: e.target.value })}
                        className="w-20"
                        aria-label="Maximum categories per participant"
                      />
                    )}
                  </div>
                  {formData.limitRegistrationsPerParticipant && (
                    <p className="text-xs text-gray-500">How many categories one participant may register for</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                  <Input
                    id="prizePool"
                    type="number"
                    value={formData.prizePool}
                    onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: 'upcoming' | 'ongoing' | 'completed' | 'cancelled') => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingTournament && (
                  <div className="space-y-2">
                    <Label htmlFor="matchFormat">Match Format</Label>
                    <Select value={formData.matchFormat} onValueChange={(value: 'single-set-11' | 'single-set' | 'best-of-3' | 'best-of-3-15pt' | 'single-set-30') => setFormData({ ...formData, matchFormat: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-set-11">Single set (11pt)</SelectItem>
                        <SelectItem value="single-set">Single set (21pt)</SelectItem>
                        <SelectItem value="best-of-3">Best of 3 (first to 2 sets)</SelectItem>
                        <SelectItem value="best-of-3-15pt">Best of 3 (15pt)</SelectItem>
                        <SelectItem value="single-set-30">30pt Single set</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {editingTournament && (
                <div className="space-y-2">
                  <Label>Rules</Label>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ScrollText className="h-4 w-4 text-blue-500" />
                      <span>
                        {formData.rules.trim()
                          ? `${formData.rules.trim().split('\n').filter(Boolean).length} lines of rules`
                          : 'No rules added yet'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => {
                        setRulesEditingTournament({ ...editingTournament, rules: formData.rules });
                        setRulesContent(formData.rules);
                        setRulesDrawerOpen(true);
                      }}
                    >
                      <ScrollText className="h-3.5 w-3.5" />
                      Edit Rules
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <ImageUpload
                  label="Tournament Banner"
                  value={formData.banner}
                  onChange={(url) => setFormData({ ...formData, banner: url || '' })}
                  aspectRatio="16/9"
                  maxSize={5}
                />
                {editingTournament && (
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox
                      id="showRegistrationTitle"
                      checked={formData.showRegistrationTitle}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        showRegistrationTitle: checked === true,
                      })}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor="showRegistrationTitle">
                        Show tournament title over banner
                      </Label>
                      <p className="text-xs text-gray-500">
                        Turn this off when the banner image already includes the tournament title.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="registrationOpen"
                    checked={formData.registrationOpen}
                    onCheckedChange={(checked) => setFormData({ ...formData, registrationOpen: checked === true })}
                  />
                  <Label htmlFor="registrationOpen">Registration Open</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked === true })}
                  />
                  <Label htmlFor="isPublic">Tournament Visible to Public</Label>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Registration Form Fields</Label>
                  <p className="text-xs text-gray-500">Choose which optional fields appear on the public registration form</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showTowerAndFlat"
                      checked={formData.showTowerAndFlat}
                      onCheckedChange={(checked) => setFormData({ ...formData, showTowerAndFlat: checked === true })}
                    />
                    <Label htmlFor="showTowerAndFlat">Tower & Flat Number</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showEmergencyContact"
                      checked={formData.showEmergencyContact}
                      onCheckedChange={(checked) => setFormData({ ...formData, showEmergencyContact: checked === true })}
                    />
                    <Label htmlFor="showEmergencyContact">Emergency Contact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showIsResident"
                      checked={formData.showIsResident}
                      onCheckedChange={(checked) => setFormData({ ...formData, showIsResident: checked === true })}
                    />
                    <Label htmlFor="showIsResident">Resident Checkbox</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showTshirtSize"
                      checked={formData.showTshirtSize}
                      onCheckedChange={(checked) => setFormData({ ...formData, showTshirtSize: checked === true })}
                    />
                    <Label htmlFor="showTshirtSize">T-Shirt Size</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showVolunteerNomination"
                      checked={formData.showVolunteerNomination}
                      onCheckedChange={(checked) => setFormData({ ...formData, showVolunteerNomination: checked === true })}
                    />
                    <Label htmlFor="showVolunteerNomination">Volunteer Nomination</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <ImageUpload
                  label="Payment QR Code (optional)"
                  value={formData.paymentQrCode}
                  onChange={(url) => setFormData({ ...formData, paymentQrCode: url || '' })}
                  aspectRatio="1/1"
                  maxSize={2}
                />
                <p className="text-xs text-gray-500">
                  Optional. If omitted, participants pay via phone/UPI accounts only.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    Payment Accounts
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, paymentAccounts: [...formData.paymentAccounts, { name: '', number: '' }] })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
                  </Button>
                </div>
                {formData.paymentAccounts.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No accounts added yet. Add UPI IDs or bank details that participants can pay to.</p>
                )}
                {formData.paymentAccounts.map((account, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Recipient name"
                      value={account.name}
                      onChange={(e) => {
                        const updated = formData.paymentAccounts.map((a, i) => i === idx ? { ...a, name: e.target.value } : a);
                        setFormData({ ...formData, paymentAccounts: updated });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="UPI ID / phone / account no."
                      value={account.number}
                      onChange={(e) => {
                        const updated = formData.paymentAccounts.map((a, i) => i === idx ? { ...a, number: e.target.value } : a);
                        setFormData({ ...formData, paymentAccounts: updated });
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, paymentAccounts: formData.paymentAccounts.filter((_, i) => i !== idx) })}
                      className="text-red-500 hover:text-red-700 flex-shrink-0 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div>
                  <Label className="text-sm font-semibold">Point of Contact</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Up to two contacts shown on the public registration form</p>
                </div>
                {formData.contacts.map((contact, idx) => (
                  <div key={idx} className="space-y-2 rounded-md border border-gray-100 bg-gray-50/50 p-3">
                    <p className="text-xs font-medium text-gray-700">Contact {idx + 1}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`contactName-${idx}`}>Name</Label>
                        <Input
                          id={`contactName-${idx}`}
                          placeholder="e.g. Tournament Coordinator"
                          value={contact.name}
                          onChange={(e) => {
                            const updated = formData.contacts.map((c, i) =>
                              i === idx ? { ...c, name: e.target.value } : c
                            );
                            setFormData({ ...formData, contacts: updated });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`contactPhone-${idx}`}>Phone Number</Label>
                        <Input
                          id={`contactPhone-${idx}`}
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={contact.phone}
                          onChange={(e) => {
                            const updated = formData.contacts.map((c, i) =>
                              i === idx ? { ...c, phone: e.target.value } : c
                            );
                            setFormData({ ...formData, contacts: updated });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappGroupLink" className="flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp Group Link
                </Label>
                <Input
                  id="whatsappGroupLink"
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={formData.whatsappGroupLink}
                  onChange={(e) => setFormData({ ...formData, whatsappGroupLink: e.target.value })}
                />
                <p className="text-xs text-gray-500">Participants will see this link on their registration confirmation screen</p>
              </div>
            </form>
          </div>
          <DrawerFooter className="flex-shrink-0">
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleSubmit} disabled={saving}>
                {saving
                  ? (editingTournament ? 'Updating…' : 'Creating…')
                  : (editingTournament ? 'Update Tournament' : 'Create Tournament')}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={rulesDrawerOpen} onOpenChange={setRulesDrawerOpen}>
        <DrawerContent side="right" className="max-w-3xl">
          <DrawerHeader className="flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-blue-600" />
                <div>
                  <DrawerTitle>Edit Rules</DrawerTitle>
                  <DrawerDescription className="mt-0.5">
                    {rulesEditingTournament?.name}
                  </DrawerDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRulesDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            <div className="flex-1 flex flex-col min-h-0 border-r border-gray-100">
              <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <button
                  type="button"
                  title="Bold (Ctrl+B)"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('**'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                >B</button>
                <button
                  type="button"
                  title="Italic (Ctrl+I)"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('*'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm italic font-serif text-gray-700 hover:bg-gray-200 transition-colors"
                >I</button>
                <button
                  type="button"
                  title="Bold + Italic"
                  onMouseDown={(e) => { e.preventDefault(); wrapSelection('***'); }}
                  className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold italic font-serif text-gray-700 hover:bg-gray-200 transition-colors"
                >BI</button>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                <div className="flex items-center gap-2 text-xs text-gray-400 select-none">
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600"># H1</code></span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">## H2</code></span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">1.</code> num</span>
                  <span><code className="bg-white px-1 rounded border border-gray-200 text-gray-600">-</code> bullet</span>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <Textarea
                  ref={rulesTextareaRef}
                  value={rulesContent}
                  onChange={(e) => setRulesContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**'); }
                    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*'); }
                  }}
                  placeholder={`# General Rules\n\n1. All players must register before the deadline.\n2. Players must arrive **15 minutes** before their scheduled match.\n\n# Scoring Rules\n\n- Each set is played to 21 points.\n- A player must win by *2 clear points*.`}
                  className="font-mono text-sm resize-none h-full min-h-[320px] border-gray-200"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-700">Live Preview</p>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {rulesContent.trim() ? (
                  <RulesPreview rules={rulesContent} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                    <ScrollText className="h-10 w-10 mb-3 text-gray-200" />
                    <p className="text-sm">Start typing to see a preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-shrink-0 border-t">
            <div className="flex justify-between items-center">
              {rulesEditingTournament && (
                <a
                  href={`/tournament/${rulesEditingTournament.id}/rules`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View public rules page
                </a>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setRulesDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRules} disabled={rulesSaving}>
                  {rulesSaving ? 'Saving…' : 'Save Rules'}
                </Button>
              </div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {AlertDialogComponent}
    </>
  );
}
