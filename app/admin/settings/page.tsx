'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Trophy,
  Save,
  X
} from 'lucide-react';

interface Sport {
  id?: string;
  value: string;
  label: string;
  icon: string;
  isActive: boolean;
  order: number;
}

interface Category {
  id?: string;
  value: string;
  label: string;
  description?: string;
  sportValue?: string; // Optional: if category is sport-specific
  isActive: boolean;
  order: number;
}

interface AppSettings {
  sports: Sport[];
  categories: Category[];
  defaultVenue?: string;
  defaultRegistrationDaysBefore?: number;
  updatedAt: Date;
  updatedBy: string;
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<Sport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultVenue, setDefaultVenue] = useState('');
  const [defaultRegistrationDaysBefore, setDefaultRegistrationDaysBefore] = useState(7);
  
  // Dialog states
  const [sportDialogOpen, setSportDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form states
  const [sportFormData, setSportFormData] = useState({
    value: '',
    label: '',
    icon: '',
    isActive: true,
    order: 0,
  });
  
  const [categoryFormData, setCategoryFormData] = useState({
    value: '',
    label: '',
    description: '',
    sportValue: '',
    isActive: true,
    order: 0,
  });

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'super-admin'))) {
      router.push('/login');
    } else if (user && (user.role === 'admin' || user.role === 'super-admin')) {
      loadSettings();
    }
  }, [user, authLoading, router]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load settings document
      const settingsDoc = await getDocs(collection(db, 'appSettings'));
      
      if (!settingsDoc.empty) {
        const settingsData = settingsDoc.docs[0].data() as AppSettings;
        setSports(settingsData.sports || []);
        setCategories(settingsData.categories || []);
        setDefaultVenue(settingsData.defaultVenue || '');
        setDefaultRegistrationDaysBefore(settingsData.defaultRegistrationDaysBefore || 7);
      } else {
        // Initialize with default values
        const defaultSports: Sport[] = [
          { value: 'badminton', label: 'Badminton', icon: '🏸', isActive: true, order: 1 },
          { value: 'table-tennis', label: 'Table Tennis', icon: '🏓', isActive: true, order: 2 },
          { value: 'volleyball', label: 'Volleyball', icon: '🏐', isActive: true, order: 3 },
          { value: 'tennis', label: 'Tennis', icon: '🎾', isActive: true, order: 4 },
          { value: 'basketball', label: 'Basketball', icon: '🏀', isActive: true, order: 5 },
          { value: 'football', label: 'Football', icon: '⚽', isActive: true, order: 6 },
          { value: 'cricket', label: 'Cricket', icon: '🏏', isActive: true, order: 7 },
          { value: 'throw-ball', label: 'Throw Ball', icon: '🏐', isActive: true, order: 8 },
          { value: 'other', label: 'Other Sport', icon: '🏆', isActive: true, order: 9 },
        ];
        
        const defaultCategories: Category[] = [
          { value: 'girls-under-13', label: 'Girls Under 13', isActive: true, order: 1 },
          { value: 'boys-under-13', label: 'Boys Under 13', isActive: true, order: 2 },
          { value: 'girls-under-18', label: 'Girls Under 18', isActive: true, order: 3 },
          { value: 'boys-under-18', label: 'Boys Under 18', isActive: true, order: 4 },
          { value: 'mens-single', label: 'Mens Single', isActive: true, order: 5 },
          { value: 'womens-single', label: 'Womens Single', isActive: true, order: 6 },
          { value: 'mens-doubles', label: 'Mens Doubles', isActive: true, order: 7 },
          { value: 'mixed-doubles', label: 'Mixed Doubles', isActive: true, order: 8 },
          { value: 'mens-team', label: 'Mens Team', isActive: true, order: 9 },
          { value: 'womens-team', label: 'Womens Team', isActive: true, order: 10 },
          { value: 'kids-team-u13', label: 'Kids Team (U13)', isActive: true, order: 11 },
          { value: 'kids-team-u18', label: 'Kids Team (U18)', isActive: true, order: 12 },
          { value: 'open-team', label: 'Open Team', isActive: true, order: 13 },
        ];
        
        setSports(defaultSports);
        setCategories(defaultCategories);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      alert({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      if (!user) return;

      const settingsData: AppSettings = {
        sports: sports.sort((a, b) => a.order - b.order),
        categories: categories.sort((a, b) => a.order - b.order),
        defaultVenue,
        defaultRegistrationDaysBefore,
        updatedAt: new Date(),
        updatedBy: user.id,
      };

      // Get or create settings document
      const settingsDoc = await getDocs(collection(db, 'appSettings'));
      
      if (!settingsDoc.empty) {
        // Update existing
        await setDoc(doc(db, 'appSettings', settingsDoc.docs[0].id), settingsData);
      } else {
        // Create new
        await addDoc(collection(db, 'appSettings'), settingsData);
      }

      alert({
        title: 'Success',
        description: 'Settings saved successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      alert({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'error'
      });
    }
  };

  const handleAddSport = () => {
    setEditingSport(null);
    setSportFormData({
      value: '',
      label: '',
      icon: '',
      isActive: true,
      order: sports.length + 1,
    });
    setSportDialogOpen(true);
  };

  const handleEditSport = (sport: Sport) => {
    setEditingSport(sport);
    setSportFormData({
      value: sport.value,
      label: sport.label,
      icon: sport.icon,
      isActive: sport.isActive,
      order: sport.order,
    });
    setSportDialogOpen(true);
  };

  const handleSaveSport = () => {
    if (!sportFormData.value || !sportFormData.label) {
      alert({
        title: 'Validation Error',
        description: 'Value and label are required',
        variant: 'error'
      });
      return;
    }

    if (editingSport) {
      // Update existing
      setSports(sports.map(s => s.value === editingSport.value ? { ...sportFormData, value: editingSport.value } : s));
    } else {
      // Check if value already exists
      if (sports.some(s => s.value === sportFormData.value)) {
        alert({
          title: 'Error',
          description: 'A sport with this value already exists',
          variant: 'error'
        });
        return;
      }
      // Add new
      setSports([...sports, sportFormData]);
    }
    
    setSportDialogOpen(false);
    setEditingSport(null);
  };

  const handleDeleteSport = (sportValue: string) => {
    setSports(sports.filter(s => s.value !== sportValue));
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      value: '',
      label: '',
      description: '',
      sportValue: '',
      isActive: true,
      order: categories.length + 1,
    });
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      value: category.value,
      label: category.label,
      description: category.description || '',
      sportValue: category.sportValue || '',
      isActive: category.isActive,
      order: category.order,
    });
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryFormData.value || !categoryFormData.label) {
      alert({
        title: 'Validation Error',
        description: 'Value and label are required',
        variant: 'error'
      });
      return;
    }

    if (editingCategory) {
      // Update existing
      setCategories(categories.map(c => c.value === editingCategory.value ? { ...categoryFormData, value: editingCategory.value } : c));
    } else {
      // Check if value already exists
      if (categories.some(c => c.value === categoryFormData.value)) {
        alert({
          title: 'Error',
          description: 'A category with this value already exists',
          variant: 'error'
        });
        return;
      }
      // Add new
      setCategories([...categories, categoryFormData]);
    }
    
    setCategoryDialogOpen(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (categoryValue: string) => {
    setCategories(categories.filter(c => c.value !== categoryValue));
  };

  if (authLoading || loading) {
    return (
      <AdminLayout moduleName="Settings">
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
    return null;
  }

  return (
    <AdminLayout moduleName="Settings">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Settings</h1>
          <p className="text-gray-600">Manage sports types, categories, and system settings</p>
        </div>

        {/* General Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Default values used throughout the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defaultVenue">Default Venue</Label>
                <Input
                  id="defaultVenue"
                  value={defaultVenue}
                  onChange={(e) => setDefaultVenue(e.target.value)}
                  placeholder="Default tournament venue"
                />
              </div>
              <div>
                <Label htmlFor="defaultRegistrationDaysBefore">Default Registration Days Before Start</Label>
                <Input
                  id="defaultRegistrationDaysBefore"
                  type="number"
                  value={defaultRegistrationDaysBefore}
                  onChange={(e) => setDefaultRegistrationDaysBefore(parseInt(e.target.value) || 7)}
                  placeholder="7"
                />
                <p className="text-xs text-gray-500 mt-1">Number of days before tournament start for registration deadline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sports Management */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Sports Types</CardTitle>
                <CardDescription>Manage available sports for tournaments</CardDescription>
              </div>
              <Button onClick={handleAddSport}>
                <Plus className="h-4 w-4 mr-2" />
                Add Sport
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No sports configured. Click "Add Sport" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Icon</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sports.sort((a, b) => a.order - b.order).map((sport) => (
                      <TableRow key={sport.value}>
                        <TableCell className="text-2xl">{sport.icon}</TableCell>
                        <TableCell className="font-medium">{sport.label}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{sport.value}</code>
                        </TableCell>
                        <TableCell>{sport.order}</TableCell>
                        <TableCell>
                          <Badge variant={sport.isActive ? "default" : "secondary"}>
                            {sport.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSport(sport)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSport(sport.value)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Manage tournament categories</CardDescription>
              </div>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No categories configured. Click "Add Category" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Sport</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.sort((a, b) => a.order - b.order).map((category) => (
                      <TableRow key={category.value}>
                        <TableCell className="font-medium">{category.label}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{category.value}</code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{category.description || '-'}</TableCell>
                        <TableCell>
                          {category.sportValue ? (
                            <Badge variant="outline">{category.sportValue}</Badge>
                          ) : (
                            <span className="text-gray-400">All Sports</span>
                          )}
                        </TableCell>
                        <TableCell>{category.order}</TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCategory(category.value)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveSettings} size="lg" className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-5 w-5 mr-2" />
            Save All Settings
          </Button>
        </div>

        {/* Sport Dialog */}
        <Dialog open={sportDialogOpen} onOpenChange={setSportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSport ? 'Edit Sport' : 'Add New Sport'}</DialogTitle>
              <DialogDescription>
                {editingSport ? 'Update sport details' : 'Add a new sport type to the system'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sportValue">Value (Code) *</Label>
                <Input
                  id="sportValue"
                  value={sportFormData.value}
                  onChange={(e) => setSportFormData({ ...sportFormData, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="badminton"
                  disabled={!!editingSport}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase, use hyphens for spaces (e.g., table-tennis)</p>
              </div>
              <div>
                <Label htmlFor="sportLabel">Label (Display Name) *</Label>
                <Input
                  id="sportLabel"
                  value={sportFormData.label}
                  onChange={(e) => setSportFormData({ ...sportFormData, label: e.target.value })}
                  placeholder="Badminton"
                  required
                />
              </div>
              <div>
                <Label htmlFor="sportIcon">Icon (Emoji) *</Label>
                <Input
                  id="sportIcon"
                  value={sportFormData.icon}
                  onChange={(e) => setSportFormData({ ...sportFormData, icon: e.target.value })}
                  placeholder="🏸"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Single emoji character</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sportOrder">Display Order</Label>
                  <Input
                    id="sportOrder"
                    type="number"
                    value={sportFormData.order}
                    onChange={(e) => setSportFormData({ ...sportFormData, order: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="sportIsActive"
                    checked={sportFormData.isActive}
                    onChange={(e) => setSportFormData({ ...sportFormData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="sportIsActive" className="mb-0">Active</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSportDialogOpen(false);
                    setEditingSport(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveSport}>
                  {editingSport ? 'Update' : 'Add'} Sport
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
              <DialogDescription>
                {editingCategory ? 'Update category details' : 'Add a new tournament category'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="categoryValue">Value (Code) *</Label>
                <Input
                  id="categoryValue"
                  value={categoryFormData.value}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="mens-single"
                  disabled={!!editingCategory}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase, use hyphens for spaces</p>
              </div>
              <div>
                <Label htmlFor="categoryLabel">Label (Display Name) *</Label>
                <Input
                  id="categoryLabel"
                  value={categoryFormData.label}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, label: e.target.value })}
                  placeholder="Men's Single"
                  required
                />
              </div>
              <div>
                <Label htmlFor="categoryDescription">Description</Label>
                <Textarea
                  id="categoryDescription"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  rows={2}
                  placeholder="Optional description for this category"
                />
              </div>
              <div>
                <Label htmlFor="categorySport">Sport (Optional)</Label>
                <Select
                  value={categoryFormData.sportValue}
                  onValueChange={(value) => setCategoryFormData({ ...categoryFormData, sportValue: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sports (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Sports</SelectItem>
                    {sports.filter(s => s.isActive).map(sport => (
                      <SelectItem key={sport.value} value={sport.value}>
                        {sport.icon} {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Leave empty to make category available for all sports</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoryOrder">Display Order</Label>
                  <Input
                    id="categoryOrder"
                    type="number"
                    value={categoryFormData.order}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, order: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="categoryIsActive"
                    checked={categoryFormData.isActive}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="categoryIsActive" className="mb-0">Active</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategoryDialogOpen(false);
                    setEditingCategory(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveCategory}>
                  {editingCategory ? 'Update' : 'Add'} Category
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {AlertDialogComponent}
      </div>
    </AdminLayout>
  );
}

