'use client';

import { Registration } from '@/types';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, HandHeart, X } from 'lucide-react';

function escapeCsvField(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportVolunteersCsv(volunteers: Registration[], tournamentName?: string) {
  const rows = [
    ['Name', 'Phone'].join(','),
    ...volunteers.map((v) =>
      [escapeCsvField(v.name), escapeCsvField(v.phone || '')].join(',')
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (tournamentName || 'tournament').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
  a.download = `${slug}-volunteers-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

interface VolunteersListDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteers: Registration[];
  tournamentName?: string;
}

export default function VolunteersListDrawer({
  open,
  onOpenChange,
  volunteers,
  tournamentName,
}: VolunteersListDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="max-w-md">
        <DrawerHeader className="flex-shrink-0 border-b text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <HandHeart className="h-5 w-5 text-pink-500" />
                Volunteers
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                {volunteers.length} {volunteers.length === 1 ? 'person' : 'people'} nominated to volunteer
                {tournamentName ? ` · ${tournamentName}` : ''}
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

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {volunteers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No volunteer nominations yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volunteers.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">{participant.name}</TableCell>
                      <TableCell>
                        {participant.phone ? (
                          <a href={`tel:${participant.phone}`} className="hover:underline">
                            {participant.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-shrink-0 flex-row gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={volunteers.length === 0}
            onClick={() => exportVolunteersCsv(volunteers, tournamentName)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
