'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Permission } from '@/types';
import {
  DEFAULT_ROLES,
  mergeRoleRegistry,
  RoleDefinition,
  ROLE_BY_SLUG,
} from '@/lib/permissions';

function toRoleDefinition(id: string, data: Record<string, unknown>): RoleDefinition {
  return {
    slug: (data.slug as string) || id,
    name: (data.name as string) || id,
    description: (data.description as string) || '',
    permissions: (data.permissions as Permission[]) || [],
    isSystem: !!data.isSystem,
  };
}

export function useRoles() {
  const [customRoles, setCustomRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'roles'), orderBy('name')));
      const loaded = snap.docs
        .map((d) => toRoleDefinition(d.id, d.data()))
        .filter((r) => !r.isSystem);
      setCustomRoles(loaded);
    } catch (error) {
      console.error('Error loading roles:', error);
      setCustomRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const registry = useMemo(() => mergeRoleRegistry(customRoles), [customRoles]);

  const roles = useMemo(() => {
    const merged = Object.values(registry);
    return merged.sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [registry]);

  const getRoleLabel = useCallback(
    (slug: string) => registry[slug]?.name ?? slug,
    [registry]
  );

  return {
    roles,
    customRoles,
    registry,
    systemRoles: DEFAULT_ROLES,
    loading,
    refresh: loadRoles,
    getRoleLabel,
  };
}

export { ROLE_BY_SLUG };
