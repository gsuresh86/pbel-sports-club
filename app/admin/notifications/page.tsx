'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notification } from '@/types';
import { Bell, Check, CheckCheck, Trash2, Filter, X } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog-component';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, AlertDialogComponent } = useAlertDialog();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'tournament' | 'registration' | 'system' | 'other'>('all');

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin'))) {
      router.push('/login');
    } else if (user && (user.role === 'admin' || user.role === 'super-admin' || user.role === 'tournament-admin')) {
      loadNotifications();
    }
  }, [user, authLoading, router]);

  // Filter notifications based on selected filters
  useEffect(() => {
    let filtered = notifications;

    // Filter by read status
    if (filter === 'unread') {
      filtered = filtered.filter((n) => !n.read);
    } else if (filter === 'read') {
      filtered = filtered.filter((n) => n.read);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter((n) => n.type === typeFilter);
    }

    setFilteredNotifications(filtered);
  }, [notifications, filter, typeFilter]);

  const loadNotifications = () => {
    if (!user?.id) return;

    setLoading(true);

    // Build query based on user role
    let notificationsQuery;
    
    if (user.role === 'admin' || user.role === 'super-admin') {
      // Admins see all notifications
      notificationsQuery = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );
    } else if (user.role === 'tournament-admin') {
      // Tournament admins see only their own notifications
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Default: user's own notifications
      notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.id),
        orderBy('createdAt', 'desc')
      );
    }

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          readAt: doc.data().readAt?.toDate() || undefined,
        })) as Notification[];

        setNotifications(notificationsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to notifications:', error);
        alert({
          title: 'Error',
          description: 'Failed to load notifications',
          variant: 'error'
        });
        setLoading(false);
      }
    );

    return unsubscribe;
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      alert({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'error'
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter((n) => !n.read);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = unreadNotifications.map((notification) =>
        updateDoc(doc(db, 'notifications', notification.id), {
          read: true,
          readAt: new Date(),
        })
      );
      await Promise.all(batch);
      alert({
        title: 'Success',
        description: `Marked ${unreadNotifications.length} notification(s) as read`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      alert({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'error'
      });
    }
  };

  const handleDelete = async (notificationId: string) => {
    confirm({
      title: 'Delete Notification',
      description: 'Are you sure you want to delete this notification?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'notifications', notificationId));
          alert({
            title: 'Success',
            description: 'Notification deleted successfully',
            variant: 'success'
          });
        } catch (error) {
          console.error('Error deleting notification:', error);
          alert({
            title: 'Error',
            description: 'Failed to delete notification',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleDeleteAllRead = async () => {
    const readNotifications = notifications.filter((n) => n.read);
    if (readNotifications.length === 0) return;

    confirm({
      title: 'Delete All Read Notifications',
      description: `Are you sure you want to delete ${readNotifications.length} read notification(s)?`,
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const batch = readNotifications.map((notification) =>
            deleteDoc(doc(db, 'notifications', notification.id))
          );
          await Promise.all(batch);
          alert({
            title: 'Success',
            description: `Deleted ${readNotifications.length} notification(s)`,
            variant: 'success'
          });
        } catch (error) {
          console.error('Error deleting notifications:', error);
          alert({
            title: 'Error',
            description: 'Failed to delete notifications',
            variant: 'error'
          });
        }
      }
    });
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.data?.tournamentId) {
      if (notification.type === 'registration') {
        router.push(`/admin/tournaments/${notification.data.tournamentId}`);
      } else {
        router.push(`/tournament/${notification.data.tournamentId}`);
      }
    } else if (notification.type === 'tournament') {
      router.push('/admin/tournaments');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'tournament':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'registration':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'system':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (authLoading || loading) {
    return (
      <AdminLayout moduleName="Notifications">
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super-admin' && user.role !== 'tournament-admin')) {
    return null;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  return (
    <AdminLayout moduleName="Notifications">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
          <p className="text-gray-600">Manage and view all your notifications</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Unread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Read</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{readCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button size="sm" variant="outline" onClick={handleMarkAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark All Read
                  </Button>
                )}
                {readCount > 0 && (
                  <Button size="sm" variant="outline" onClick={handleDeleteAllRead}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Read
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Notifications</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(filter !== 'all' || typeFilter !== 'all') && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
                <span className="text-sm text-gray-600">
                  Showing {filteredNotifications.length} of {notifications.length} notifications
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              {filteredNotifications.length === 0
                ? 'No notifications found'
                : `${filteredNotifications.length} notification${filteredNotifications.length > 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No notifications to display</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                      !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span className="h-2 w-2 bg-blue-600 rounded-full"></span>
                          )}
                          <Badge variant="outline" className={getTypeColor(notification.type)}>
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{notification.body}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{formatDate(notification.createdAt)}</span>
                          {notification.read && notification.readAt && (
                            <span>Read {formatDate(notification.readAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {AlertDialogComponent}
        {ConfirmDialogComponent}
      </div>
    </AdminLayout>
  );
}

