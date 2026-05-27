'use client';

import type { ReactNode } from 'react';
import { Registration } from '@/types';
import { parsePaymentRecipient } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { CheckCircle, Pencil, Trash2, X, XCircle } from 'lucide-react';

type RegistrationWithTournament = Registration & {
  tournamentId: string;
  tournamentName: string;
};

function formatCategory(category?: string) {
  if (!category) return '—';
  return category
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: Date | string) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{empty ? '—' : value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground border-b pb-2">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'approved':
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'rejected':
    case 'refunded':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

interface RegistrationReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: RegistrationWithTournament | null;
  onApprove?: (participantId: string) => void | Promise<void>;
  onReject?: (participantId: string) => void | Promise<void>;
  onEdit?: (participantId: string) => void;
  onDelete?: (participantId: string) => void;
  actionLoading?: boolean;
}

export default function RegistrationReviewDrawer({
  open,
  onOpenChange,
  participant,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  actionLoading = false,
}: RegistrationReviewDrawerProps) {
  if (!participant) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent side="right" className="max-w-lg" />
      </Drawer>
    );
  }

  const paymentRecipient = parsePaymentRecipient(participant.selectedPaymentAccount);
  const hasPartner =
    participant.partnerName ||
    participant.partnerPhone ||
    participant.partnerEmail ||
    participant.partnerTower ||
    participant.partnerFlatNumber ||
    participant.partnerProfilePhotoUrl;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="max-w-xl">
        <DrawerHeader className="flex-shrink-0 border-b text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="flex min-w-0 items-start gap-3">
              {participant.profilePhotoUrl ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={participant.profilePhotoUrl}
                    alt={participant.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm text-muted-foreground">
                  {participant.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <DrawerTitle className="truncate">{participant.name}</DrawerTitle>
                <DrawerDescription className="mt-1">
                  {participant.tournamentName} · {participant.registrationCode}
                </DrawerDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={`capitalize ${statusBadgeClass(participant.registrationStatus)}`}>
                    {participant.registrationStatus}
                  </Badge>
                  <Badge className={`capitalize ${statusBadgeClass(participant.paymentStatus)}`}>
                    Payment: {participant.paymentStatus}
                  </Badge>
                </div>
              </div>
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
          <Section title="Personal details">
            <DetailItem label="Full name" value={participant.name} />
            <DetailItem label="Email" value={participant.email} />
            <DetailItem label="Phone" value={participant.phone} />
            <DetailItem label="Age" value={participant.age} />
            <DetailItem label="Gender" value={<span className="capitalize">{participant.gender}</span>} />
            <DetailItem
              label="Tower / Flat"
              value={
                participant.tower || participant.flatNumber
                  ? [participant.tower && `Tower ${participant.tower}`, participant.flatNumber && `Flat ${participant.flatNumber}`]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
            />
            <DetailItem label="Emergency contact" value={participant.emergencyContact} />
            <DetailItem
              label="Resident"
              value={participant.isResident === undefined ? undefined : participant.isResident ? 'Yes' : 'No'}
            />
          </Section>

          <Section title="Tournament & category">
            <DetailItem label="Tournament" value={participant.tournamentName} />
            <DetailItem label="Category" value={formatCategory(participant.selectedCategory)} />
            <DetailItem label="Expertise level" value={<span className="capitalize">{participant.expertiseLevel}</span>} />
            <DetailItem label="Previous experience" value={participant.previousExperience} />
            <DetailItem label="Team preference" value={participant.teamPreference} />
            <DetailItem label="T-shirt size" value={participant.tshirtSize} />
            <DetailItem
              label="Volunteer"
              value={participant.isVolunteer === undefined ? undefined : participant.isVolunteer ? 'Yes' : 'No'}
            />
          </Section>

          {hasPartner && (
            <Section title="Partner details">
              <DetailItem label="Partner name" value={participant.partnerName} />
              <DetailItem label="Partner email" value={participant.partnerEmail} />
              <DetailItem label="Partner phone" value={participant.partnerPhone} />
              <DetailItem
                label="Partner tower / flat"
                value={
                  participant.partnerTower || participant.partnerFlatNumber
                    ? [
                        participant.partnerTower && `Tower ${participant.partnerTower}`,
                        participant.partnerFlatNumber && `Flat ${participant.partnerFlatNumber}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined
                }
              />
              <DetailItem label="Partner t-shirt size" value={participant.partnerTshirtSize} />
              {participant.partnerProfilePhotoUrl && (
                <div className="sm:col-span-2 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Partner photo</p>
                  <div className="relative h-24 w-24 overflow-hidden rounded-lg border bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={participant.partnerProfilePhotoUrl}
                      alt={participant.partnerName || 'Partner'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Payment">
            <DetailItem label="Payment status" value={<span className="capitalize">{participant.paymentStatus}</span>} />
            <DetailItem label="Payment method" value={participant.paymentMethod?.replace(/_/g, ' ')} />
            <DetailItem label="Amount" value={participant.paymentAmount != null ? `₹${participant.paymentAmount}` : undefined} />
            <DetailItem label="Reference" value={participant.paymentReference} />
            <DetailItem
              label="Paid to"
              value={
                paymentRecipient?.name
                  ? paymentRecipient.number
                    ? `${paymentRecipient.name} (${paymentRecipient.number})`
                    : paymentRecipient.name
                  : undefined
              }
            />
            <DetailItem label="Verified at" value={formatDate(participant.paymentVerifiedAt)} />
          </Section>

          <Section title="Registration record">
            <DetailItem label="Registration code" value={participant.registrationCode} />
            <DetailItem label="Registered at" value={formatDate(participant.registeredAt)} />
            <DetailItem label="Approved at" value={formatDate(participant.approvedAt)} />
            <DetailItem label="Approved by" value={participant.approvedBy} />
          </Section>
        </div>

        <DrawerFooter className="flex-shrink-0 border-t">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" disabled={actionLoading} onClick={() => onEdit(participant.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={actionLoading}
                  onClick={() => onDelete(participant.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <DrawerClose asChild>
              <Button variant="outline" disabled={actionLoading}>
                Close
              </Button>
            </DrawerClose>
            {participant.registrationStatus === 'pending' && onReject && onApprove && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={actionLoading}
                  onClick={() => onReject(participant.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={actionLoading}
                  onClick={() => onApprove(participant.id)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
            {participant.registrationStatus === 'approved' && onReject && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                disabled={actionLoading}
                onClick={() => onReject(participant.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            )}
            {participant.registrationStatus === 'rejected' && onApprove && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={actionLoading}
                onClick={() => onApprove(participant.id)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
