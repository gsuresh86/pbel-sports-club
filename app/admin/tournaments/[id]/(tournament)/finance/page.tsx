'use client';

import { useMemo, useState } from 'react';
import {
  useTournament,
  useTournamentRegistrations,
} from '@/hooks/use-tournament-queries';
import {
  useTournamentFinances,
  useAddFinanceEntry,
  useUpdateFinanceEntry,
  useDeleteFinanceEntry,
} from '@/hooks/use-finance-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatCurrency } from '@/lib/utils';
import {
  FINANCE_INCOME_CATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
  type FinanceEntry,
  type FinanceEntryType,
} from '@/types';
import type { FinanceEntryInput } from '@/lib/finance-api';
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
} from 'lucide-react';

import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

const INCOME_LABELS: Record<string, string> = {
  sponsor: 'Sponsor',
  donation: 'Donation',
  registration: 'Registration (manual)',
  other: 'Other',
};

const EXPENSE_LABELS: Record<string, string> = {
  tshirt: 'T-Shirts',
  banner: 'Banners',
  snacks: 'Snacks',
  awards: 'Awards & Trophies',
  venue: 'Venue',
  equipment: 'Equipment',
  other: 'Other',
};

const categoryLabel = (type: FinanceEntryType, category: string) =>
  (type === 'income' ? INCOME_LABELS : EXPENSE_LABELS)[category] ?? category;

interface FormState {
  type: FinanceEntryType;
  category: string;
  description: string;
  amount: string;
  date: string;
  note: string;
}

const emptyForm = (type: FinanceEntryType = 'expense'): FormState => ({
  type,
  category: type === 'income' ? FINANCE_INCOME_CATEGORIES[0] : FINANCE_EXPENSE_CATEGORIES[0],
  description: '',
  amount: '',
  date: '',
  note: '',
});

const toDateInput = (d?: Date) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    : '';

const formatDisplayDate = (d?: Date) =>
  d
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

export default function FinancePage() {
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('finance');

  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: registrations = [] } = useTournamentRegistrations(tournamentId, {
    enabled: queriesEnabled,
  });
  const { data: finances = [], isLoading: financesLoading } = useTournamentFinances(
    tournamentId,
    { enabled: queriesEnabled }
  );

  const addMutation = useAddFinanceEntry(tournamentId);
  const updateMutation = useUpdateFinanceEntry(tournamentId);
  const deleteMutation = useDeleteFinanceEntry(tournamentId);
  const saving = addMutation.isPending || updateMutation.isPending;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const tournament = tournamentData ?? null;

  // Registration income is auto-derived from paid registrations.
  const { registrationIncome, paidCount } = useMemo(() => {
    const paid = registrations.filter((r) => r.paymentStatus === 'paid');
    return {
      registrationIncome: paid.reduce((sum, r) => sum + (r.paymentAmount ?? 0), 0),
      paidCount: paid.length,
    };
  }, [registrations]);

  const incomeEntries = useMemo(() => finances.filter((f) => f.type === 'income'), [finances]);
  const expenseEntries = useMemo(() => finances.filter((f) => f.type === 'expense'), [finances]);

  const manualIncome = incomeEntries.reduce((s, f) => s + f.amount, 0);
  const totalIncome = registrationIncome + manualIncome;
  const totalExpense = expenseEntries.reduce((s, f) => s + f.amount, 0);
  const net = totalIncome - totalExpense;

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenseEntries.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenseEntries]);

  if (!tournament) return null;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm('expense'));
    setDialogOpen(true);
  };

  const openEdit = (entry: FinanceEntry) => {
    setEditing(entry);
    setForm({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: String(entry.amount),
      date: toDateInput(entry.date),
      note: entry.note ?? '',
    });
    setDialogOpen(true);
  };

  const onTypeChange = (type: FinanceEntryType) => {
    const categories = type === 'income' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;
    setForm((prev) => ({
      ...prev,
      type,
      category: (categories as readonly string[]).includes(prev.category)
        ? prev.category
        : categories[0],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) {
      alert({ title: 'Validation Error', description: 'Description is required', variant: 'error' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      alert({ title: 'Validation Error', description: 'Enter a valid amount greater than 0', variant: 'error' });
      return;
    }

    const input: FinanceEntryInput = {
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount,
      date: form.date ? new Date(`${form.date}T00:00:00`) : null,
      note: form.note.trim() || null,
    };

    const onSuccess = () => setDialogOpen(false);
    const onError = () =>
      alert({ title: 'Error', description: 'Failed to save the entry. Please try again.', variant: 'error' });

    if (editing) {
      updateMutation.mutate({ entryId: editing.id, input }, { onSuccess, onError });
    } else {
      addMutation.mutate({ input, createdBy: user?.id }, { onSuccess, onError });
    }
  };

  const handleDelete = (entry: FinanceEntry) => {
    confirm({
      title: 'Delete Entry',
      description: `Delete "${entry.description}" (${formatCurrency(entry.amount)})? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: () =>
        deleteMutation.mutate(entry.id, {
          onError: () =>
            alert({ title: 'Error', description: 'Failed to delete the entry.', variant: 'error' }),
        }),
    });
  };

  const renderEntryRows = (entries: FinanceEntry[], emptyText: string) => {
    if (entries.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-6">
            {emptyText}
          </TableCell>
        </TableRow>
      );
    }
    return entries.map((entry) => (
      <TableRow key={entry.id}>
        <TableCell className="text-xs sm:text-sm py-2 whitespace-nowrap">
          {formatDisplayDate(entry.date)}
        </TableCell>
        <TableCell className="py-2">
          <Badge variant="outline" className="text-xs">
            {categoryLabel(entry.type, entry.category)}
          </Badge>
        </TableCell>
        <TableCell className="text-xs sm:text-sm py-2">
          <div className="font-medium">{entry.description}</div>
          {entry.note && <div className="text-xs text-gray-500">{entry.note}</div>}
        </TableCell>
        <TableCell className="text-right font-semibold text-xs sm:text-sm py-2 whitespace-nowrap">
          {formatCurrency(entry.amount)}
        </TableCell>
        <TableCell className="py-2">
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(entry)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
              onClick={() => handleDelete(entry)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  const categories = form.type === 'income' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold sm:text-lg">Finance</h3>
          <p className="text-xs text-gray-600 sm:text-sm">
            Track tournament income and expenses. Registration income is calculated automatically
            from paid registrations.
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Entry
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2.5">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Income</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-2.5">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Expenses</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${net >= 0 ? 'bg-blue-100' : 'bg-amber-100'}`}>
              <Wallet className={`h-5 w-5 ${net >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-600">Net Balance</p>
              <p className={`text-xl font-bold ${net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                {formatCurrency(net)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income */}
      <Card className="rounded-none">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <CardTitle className="text-sm font-semibold sm:text-base">Income</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Auto registration income */}
          <div className="flex items-center justify-between gap-3 border-y bg-green-50/60 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium sm:text-sm">
                  Registration collections
                  <Badge variant="outline" className="ml-2 text-[10px] uppercase">Auto</Badge>
                </div>
                <div className="text-xs text-gray-500">
                  From {paidCount} paid registration{paidCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="text-right font-semibold text-sm whitespace-nowrap text-green-700">
              {formatCurrency(registrationIncome)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-xs sm:text-sm">Date</TableHead>
                  <TableHead className="text-xs sm:text-sm">Category</TableHead>
                  <TableHead className="text-xs sm:text-sm">Description</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Amount</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financesLoading
                  ? null
                  : renderEntryRows(incomeEntries, 'No manual income entries yet (e.g. sponsors).')}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card className="rounded-none">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
          <CardTitle className="text-sm font-semibold sm:text-base">Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenseByCategory.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b">
              {expenseByCategory.map(([cat, amt]) => (
                <Badge key={cat} variant="outline" className="text-xs font-normal">
                  {categoryLabel('expense', cat)}: {formatCurrency(amt)}
                </Badge>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="text-xs sm:text-sm">Date</TableHead>
                  <TableHead className="text-xs sm:text-sm">Category</TableHead>
                  <TableHead className="text-xs sm:text-sm">Description</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Amount</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financesLoading
                  ? null
                  : renderEntryRows(
                      expenseEntries,
                      'No expenses yet (e.g. t-shirts, banners, snacks, awards).'
                    )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
            <DialogDescription>
              Record an income or expense line for this tournament.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => onTypeChange(v as FinanceEntryType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {categoryLabel(form.type, cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={form.type === 'income' ? 'e.g. Title sponsor' : 'e.g. 50 event t-shirts'}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Any extra detail"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {AlertDialogComponent}
      {ConfirmDialogComponent}
    </div>
  );
}
