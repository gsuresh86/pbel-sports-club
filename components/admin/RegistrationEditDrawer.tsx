'use client';

import { useEffect, useState } from 'react';
import { CategoryType, Registration } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Save, X } from 'lucide-react';

const TOWERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'];

type RegistrationWithTournament = Registration & {
  tournamentId: string;
  tournamentName: string;
};

/** Subset of registration fields the admin can edit. */
export interface RegistrationEditValues {
  name: string;
  email: string;
  phone: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  tower: string;
  flatNumber: string;
  emergencyContact: string;
  isResident: boolean;
  selectedCategory: CategoryType | '';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  previousExperience: string;
  tshirtSize: string;
  isVolunteer: boolean;
  partnerName: string;
  partnerPhone: string;
  partnerEmail: string;
  partnerAge: string;
  partnerTower: string;
  partnerFlatNumber: string;
  partnerTshirtSize: string;
  paymentReference: string;
  paymentAmount: string;
  paymentMethod: 'qr_code' | 'phone_number' | '';
}

function toFormValues(p: RegistrationWithTournament): RegistrationEditValues {
  return {
    name: p.name ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    age: p.age != null ? String(p.age) : '',
    gender: p.gender ?? '',
    tower: p.tower ?? '',
    flatNumber: p.flatNumber ?? '',
    emergencyContact: p.emergencyContact ?? '',
    isResident: p.isResident ?? false,
    selectedCategory: p.selectedCategory ?? '',
    expertiseLevel: p.expertiseLevel ?? 'beginner',
    previousExperience: p.previousExperience ?? '',
    tshirtSize: p.tshirtSize ?? '',
    isVolunteer: p.isVolunteer ?? false,
    partnerName: p.partnerName ?? '',
    partnerPhone: p.partnerPhone ?? '',
    partnerEmail: p.partnerEmail ?? '',
    partnerAge: p.partnerAge != null ? String(p.partnerAge) : '',
    partnerTower: p.partnerTower ?? '',
    partnerFlatNumber: p.partnerFlatNumber ?? '',
    partnerTshirtSize: p.partnerTshirtSize ?? '',
    paymentReference: p.paymentReference ?? '',
    paymentAmount: p.paymentAmount != null ? String(p.paymentAmount) : '',
    paymentMethod: p.paymentMethod ?? '',
  };
}

function formatCategory(category: string) {
  return category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface RegistrationEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: RegistrationWithTournament | null;
  /** Categories available for the participant's tournament. */
  availableCategories?: CategoryType[];
  onSave: (participantId: string, values: RegistrationEditValues) => Promise<boolean> | boolean;
  saving?: boolean;
}

export default function RegistrationEditDrawer({
  open,
  onOpenChange,
  participant,
  availableCategories = [],
  onSave,
  saving = false,
}: RegistrationEditDrawerProps) {
  const [values, setValues] = useState<RegistrationEditValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset the form whenever a different participant is opened.
  useEffect(() => {
    if (open && participant) {
      setValues(toFormValues(participant));
      setErrors({});
    }
  }, [open, participant]);

  if (!participant || !values) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="right" className="max-w-xl" />
      </Drawer>
    );
  }

  const setField = <K extends keyof RegistrationEditValues>(key: K, value: RegistrationEditValues[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // Categories to show: the tournament's categories, always including the current one.
  const categoryOptions = Array.from(
    new Set<string>([...availableCategories, ...(values.selectedCategory ? [values.selectedCategory] : [])]),
  );

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = 'Name is required';
    if (!values.email.trim()) next.email = 'Email is required';
    else if (!values.email.includes('@')) next.email = 'Enter a valid email';
    if (!values.phone.trim()) next.phone = 'Phone is required';
    if (!values.age.trim()) next.age = 'Age is required';
    else if (Number.isNaN(Number(values.age)) || Number(values.age) <= 0) next.age = 'Age must be a number';
    if (!values.gender) next.gender = 'Gender is required';
    if (!values.selectedCategory) next.selectedCategory = 'Category is required';

    // Category / gender consistency (mirrors the public registration form).
    const cat = values.selectedCategory;
    if (cat && values.gender) {
      const maleOnly = ['boys-under-13', 'boys-under-18', 'mens-single', 'mens-doubles', 'mens-team'];
      const femaleOnly = ['girls-under-13', 'girls-under-18', 'womens-single', 'womens-doubles', 'womens-team'];
      if (maleOnly.includes(cat) && values.gender !== 'male') next.gender = 'This category is for male players only';
      if (femaleOnly.includes(cat) && values.gender !== 'female') next.gender = 'This category is for female players only';
    }

    if (values.paymentAmount.trim() && Number.isNaN(Number(values.paymentAmount))) {
      next.paymentAmount = 'Amount must be a number';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const ok = await onSave(participant.id, values);
    if (ok) onOpenChange(false);
  };

  const err = (key: string) => errors[key];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="max-w-xl">
        <DrawerHeader className="flex-shrink-0 border-b text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DrawerTitle className="truncate">Edit registration</DrawerTitle>
              <DrawerDescription className="mt-1">
                {participant.tournamentName} · {participant.registrationCode}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Personal details */}
          <section className="space-y-3">
            <h3 className="border-b pb-2 text-sm font-semibold text-foreground">Personal details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name" error={err('name')}>
                <Input value={values.name} onChange={(e) => setField('name', e.target.value)} />
              </Field>
              <Field label="Email" error={err('email')}>
                <Input type="email" value={values.email} onChange={(e) => setField('email', e.target.value)} />
              </Field>
              <Field label="Phone" error={err('phone')}>
                <Input value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
              </Field>
              <Field label="Age" error={err('age')}>
                <Input type="number" value={values.age} onChange={(e) => setField('age', e.target.value)} />
              </Field>
              <Field label="Gender" error={err('gender')}>
                <Select value={values.gender} onValueChange={(v) => setField('gender', v as RegistrationEditValues['gender'])}>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tower">
                <Select value={values.tower} onValueChange={(v) => setField('tower', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tower" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOWERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        Tower {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Flat number">
                <Input value={values.flatNumber} onChange={(e) => setField('flatNumber', e.target.value)} />
              </Field>
              <Field label="Emergency contact">
                <Input value={values.emergencyContact} onChange={(e) => setField('emergencyContact', e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={values.isResident}
                onCheckedChange={(checked) => setField('isResident', checked === true)}
              />
              Resident
            </label>
          </section>

          {/* Tournament & category */}
          <section className="space-y-3">
            <h3 className="border-b pb-2 text-sm font-semibold text-foreground">Tournament &amp; category</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Category" error={err('selectedCategory')}>
                <Select
                  value={values.selectedCategory}
                  onValueChange={(v) => setField('selectedCategory', v as CategoryType)}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {formatCategory(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Playing level">
                <Select
                  value={values.expertiseLevel}
                  onValueChange={(v) => setField('expertiseLevel', v as RegistrationEditValues['expertiseLevel'])}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="T-shirt size">
                <Input value={values.tshirtSize} onChange={(e) => setField('tshirtSize', e.target.value)} />
              </Field>
            </div>
            <Field label="Previous experience">
              <Textarea
                value={values.previousExperience}
                onChange={(e) => setField('previousExperience', e.target.value)}
                rows={2}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={values.isVolunteer}
                onCheckedChange={(checked) => setField('isVolunteer', checked === true)}
              />
              Volunteer
            </label>
          </section>

          {/* Partner details */}
          <section className="space-y-3">
            <h3 className="border-b pb-2 text-sm font-semibold text-foreground">Partner details (doubles)</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Partner name">
                <Input value={values.partnerName} onChange={(e) => setField('partnerName', e.target.value)} />
              </Field>
              <Field label="Partner email">
                <Input type="email" value={values.partnerEmail} onChange={(e) => setField('partnerEmail', e.target.value)} />
              </Field>
              <Field label="Partner phone">
                <Input value={values.partnerPhone} onChange={(e) => setField('partnerPhone', e.target.value)} />
              </Field>
              <Field label="Partner age">
                <Input type="number" value={values.partnerAge} onChange={(e) => setField('partnerAge', e.target.value)} />
              </Field>
              <Field label="Partner tower">
                <Select value={values.partnerTower} onValueChange={(v) => setField('partnerTower', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tower" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOWERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        Tower {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Partner flat number">
                <Input value={values.partnerFlatNumber} onChange={(e) => setField('partnerFlatNumber', e.target.value)} />
              </Field>
              <Field label="Partner t-shirt size">
                <Input value={values.partnerTshirtSize} onChange={(e) => setField('partnerTshirtSize', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Payment */}
          <section className="space-y-3">
            <h3 className="border-b pb-2 text-sm font-semibold text-foreground">Payment</h3>
            <p className="text-xs text-muted-foreground">
              Payment and registration status are managed from the table actions.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Payment reference">
                <Input value={values.paymentReference} onChange={(e) => setField('paymentReference', e.target.value)} />
              </Field>
              <Field label="Amount (₹)" error={err('paymentAmount')}>
                <Input type="number" value={values.paymentAmount} onChange={(e) => setField('paymentAmount', e.target.value)} />
              </Field>
              <Field label="Payment method">
                <Select
                  value={values.paymentMethod}
                  onValueChange={(v) => setField('paymentMethod', v as RegistrationEditValues['paymentMethod'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qr_code">QR code</SelectItem>
                    <SelectItem value="phone_number">Phone number</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>
        </div>

        <DrawerFooter className="flex-shrink-0 border-t">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <DrawerClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </DrawerClose>
            <Button onClick={handleSubmit} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
