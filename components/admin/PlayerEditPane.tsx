'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatCategoryLabel,
  normalizePlayerName,
  playerEditValuesFromRow,
  playerInitials,
  type PlayerEditValues,
  type UniquePlayerRow,
} from '@/lib/tournament-players';
import { Camera, Loader2, Save, X } from 'lucide-react';

const TOWERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'];
const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

interface PlayerEditPaneProps {
  player: UniquePlayerRow;
  saving: boolean;
  uploadingPhoto: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: PlayerEditValues) => Promise<void> | void;
  onUploadPhoto: (file: File) => Promise<string | void> | string | void;
}

export function PlayerEditPane({
  player,
  saving,
  uploadingPhoto,
  error,
  onClose,
  onSave,
  onUploadPhoto,
}: PlayerEditPaneProps) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<PlayerEditValues>(() => playerEditValuesFromRow(player));
  const playerKey = normalizePlayerName(player.name);

  useEffect(() => {
    setValues(playerEditValuesFromRow(player));
  }, [playerKey]);

  const setField = <K extends keyof PlayerEditValues>(key: K, value: PlayerEditValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const initials = playerInitials(values.name || player.name);
  const photoUrl = values.profilePhotoUrl;

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-t bg-white sm:w-[380px] sm:border-l sm:border-t-0 lg:w-[420px]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">Edit player</h4>
          <p className="truncate text-xs text-muted-foreground">{player.name}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void (async () => {
              const url = await onUploadPhoto(file);
              if (url) setField('profilePhotoUrl', url);
              if (photoInputRef.current) photoInputRef.current.value = '';
            })();
          }}
        />

        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto || saving}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Change photo"
          >
            {photoUrl ? (
              <Image src={photoUrl} alt={values.name} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center bg-gray-800 text-sm font-bold text-white">
                {initials || '?'}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Camera className="h-4 w-4 text-white" />
              )}
            </div>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium">Profile photo</p>
            <p className="text-xs text-muted-foreground">Click the photo to upload a new one</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {player.categories.map((cat) => (
            <Badge key={cat} variant="outline" className="text-[10px] capitalize">
              {formatCategoryLabel(cat)}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Field label="Full name">
            <Input value={values.name} onChange={(e) => setField('name', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={values.email} onChange={(e) => setField('email', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <Input type="number" value={values.age} onChange={(e) => setField('age', e.target.value)} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={values.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
            </Field>
          </div>
          {player.hasPrimaryRole && (
            <Field label="Gender">
              <Select value={values.gender} onValueChange={(v) => setField('gender', v)}>
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
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tower">
              <Select value={values.tower || undefined} onValueChange={(v) => setField('tower', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tower" />
                </SelectTrigger>
                <SelectContent>
                  {TOWERS.map((tower) => (
                    <SelectItem key={tower} value={tower}>
                      Tower {tower}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Flat number">
              <Input value={values.flatNumber} onChange={(e) => setField('flatNumber', e.target.value)} />
            </Field>
          </div>
          <Field label="Emergency contact">
            <Input value={values.emergencyContact} onChange={(e) => setField('emergencyContact', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="T-shirt size">
              <Select value={values.tshirtSize || undefined} onValueChange={(v) => setField('tshirtSize', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {TSHIRT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {player.hasPrimaryRole && (
              <Field label="Playing level">
                <Select value={values.expertiseLevel || undefined} onValueChange={(v) => setField('expertiseLevel', v)}>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level} className="capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={values.tshirtTaken}
              onCheckedChange={(checked) => setField('tshirtTaken', checked === true)}
            />
            T-shirt taken
          </label>
          {player.hasPrimaryRole && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.isResident}
                  onCheckedChange={(checked) => setField('isResident', checked === true)}
                />
                Resident
              </label>
              <Field label="Previous experience">
                <Textarea
                  rows={2}
                  value={values.previousExperience}
                  onChange={(e) => setField('previousExperience', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={saving || uploadingPhoto || !values.name.trim()}
          onClick={() => void onSave(values)}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
