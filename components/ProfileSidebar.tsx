'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { UserProfilePhotoUpload } from '@/components/ui/user-profile-photo-upload';
import { getRoleLabel } from '@/lib/profile-utils';
import { Loader2, X } from 'lucide-react';

interface ProfileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSidebar({ open, onOpenChange }: ProfileSidebarProps) {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setProfilePhotoUrl(user.profilePhotoUrl ?? null);
      setError('');
      setSuccess('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setPasswordSuccess('');
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateDoc(doc(db, 'users', user.id), {
        name: trimmedName,
        profilePhotoUrl: profilePhotoUrl || null,
        updatedAt: new Date(),
      });
      await refreshUser();
      setSuccess('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password');
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setPasswordError('You must be signed in to change your password');
      return;
    }

    setChangingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      const idToken = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        setPasswordError(data.error || 'Failed to change password');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed successfully');
    } catch (err: unknown) {
      console.error('Error changing password:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordError('Current password is incorrect');
      } else if (code === 'auth/too-many-requests') {
        setPasswordError('Too many attempts. Please try again later.');
      } else {
        setPasswordError('Failed to change password. Please try again.');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent side="right" className="max-w-md">
        <DrawerHeader className="border-b text-left">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DrawerTitle>My Profile</DrawerTitle>
              <DrawerDescription>Update your profile details and password</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {!user ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <UserProfilePhotoUpload
                userId={user.id}
                value={profilePhotoUrl}
                onChange={setProfilePhotoUrl}
                disabled={saving}
                onUploadingChange={setUploadingPhoto}
              />

              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={saving || uploadingPhoto}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  value={user.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">Email cannot be changed here</p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Badge variant="secondary">{getRoleLabel(user.role)}</Badge>
              </div>

              <div className="border-t pt-6 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Change password</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your current password, then choose a new one.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-current-password">Current password</Label>
                  <Input
                    id="profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={changingPassword || saving || uploadingPhoto}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-new-password">New password</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={changingPassword || saving || uploadingPhoto}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-confirm-password">Confirm new password</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={changingPassword || saving || uploadingPhoto}
                  />
                </div>

                {passwordError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    {passwordSuccess}
                  </p>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePasswordChange}
                  disabled={changingPassword || saving || uploadingPhoto}
                  className="w-full"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing password…
                    </>
                  ) : (
                    'Change password'
                  )}
                </Button>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  {success}
                </p>
              )}
            </div>

            <DrawerFooter className="border-t">
              <Button type="submit" disabled={saving || uploadingPhoto}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
