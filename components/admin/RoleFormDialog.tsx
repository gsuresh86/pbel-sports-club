'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Permission } from '@/types';
import {
  normalizeRolePermissions,
  PERMISSION_GROUPS,
  RoleDefinition,
  slugifyRoleName,
} from '@/lib/permissions';

export interface RoleFormValues {
  name: string;
  slug: string;
  description: string;
  permissions: Permission[];
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRole?: RoleDefinition | null;
  existingSlugs: string[];
  onSubmit: (values: RoleFormValues) => Promise<void>;
}

const emptyForm = (): RoleFormValues => ({
  name: '',
  slug: '',
  description: '',
  permissions: [],
});

export function RoleFormDialog({
  open,
  onOpenChange,
  initialRole,
  existingSlugs,
  onSubmit,
}: RoleFormDialogProps) {
  const isEditing = !!initialRole && !initialRole.isSystem;
  const readOnly = !!initialRole?.isSystem;
  const [form, setForm] = useState<RoleFormValues>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSlugTouched(false);
    if (initialRole) {
      setForm({
        name: initialRole.name,
        slug: initialRole.slug,
        description: initialRole.description,
        permissions: [...initialRole.permissions],
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, initialRole]);

  const togglePermission = (key: Permission) => {
    setForm((prev) => {
      const has = prev.permissions.includes(key);
      let next = has
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key];
      if (key === 'tournament.matches.write' && !has) {
        if (!next.includes('tournament.matches')) next.push('tournament.matches');
      }
      if (key === 'tournament.matches' && has) {
        next = next.filter((p) => p !== 'tournament.matches.write');
      }
      return { ...prev, permissions: next };
    });
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched || isEditing ? prev.slug : slugifyRoleName(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    const slug = form.slug.trim();
    const permissions = normalizeRolePermissions(form.permissions);

    if (!name) {
      setError('Role name is required');
      return;
    }
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('Slug must be lowercase letters, numbers, and hyphens only');
      return;
    }
    if (permissions.length === 0) {
      setError('Select at least one access permission');
      return;
    }
    const slugTaken = existingSlugs.some(
      (s) => s === slug && s !== initialRole?.slug
    );
    if (slugTaken) {
      setError('A role with this slug already exists');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name,
        slug,
        description: form.description.trim(),
        permissions,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? 'View Role' : isEditing ? 'Edit Role' : 'Create Role'}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'System roles cannot be modified.'
              : 'Define a role name and map which tournament areas this role can access.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Scorekeeper"
              disabled={readOnly}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-slug">Slug</Label>
            <Input
              id="role-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((p) => ({ ...p, slug: slugifyRoleName(e.target.value) }));
              }}
              placeholder="scorekeeper"
              disabled={readOnly || isEditing}
              required
            />
            <p className="text-xs text-gray-500">Used internally when assigning roles to staff.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What can people with this role do?"
              rows={2}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-3">
            <Label>Access mapping</Label>
            <div className="space-y-3 rounded-md border p-3 max-h-[320px] overflow-y-auto">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div>
                    <div className="text-sm font-medium">{group.label}</div>
                    <div className="text-xs text-gray-500">{group.description}</div>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {group.permissions.map((perm) => {
                      const checkboxId = `perm-${perm.key}`;
                      return (
                        <div key={perm.key} className="flex items-start gap-2">
                          <Checkbox
                            id={checkboxId}
                            checked={form.permissions.includes(perm.key)}
                            onCheckedChange={() => togglePermission(perm.key)}
                            disabled={readOnly}
                            className="mt-0.5"
                          />
                          <label htmlFor={checkboxId} className="cursor-pointer">
                            <div className="text-sm">{perm.label}</div>
                            {perm.hint && (
                              <div className="text-xs text-gray-500">{perm.hint}</div>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : isEditing ? 'Save Role' : 'Create Role'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
