'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'tourneycraft-pwa-install-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || Boolean(iosStandalone);
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  const onAdmin = pathname.startsWith('/admin');
  const onScorePage = /\/admin\/matches\/[^/]+\/score/.test(pathname);

  useEffect(() => {
    if (!onAdmin || onScorePage) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    if (isStandaloneDisplay()) return;

    const iosDevice = isIosDevice();
    setIos(iosDevice);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    if (iosDevice) {
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [onAdmin, onScorePage]);

  if (!onAdmin || onScorePage || !visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 z-40 rounded-lg border bg-white p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-80 bottom-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Install TourneyCraft</p>
          {ios ? (
            <p className="mt-1 text-xs text-gray-600">
              Tap <Share className="mb-0.5 inline h-3.5 w-3.5" /> Share, then Add to Home Screen for a full-screen scoring app.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-600">
              Add this app to your home screen to run matches without browser chrome.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={dismiss}
          aria-label="Dismiss install hint"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!ios && deferred && (
        <Button
          type="button"
          size="sm"
          className="mt-2 min-h-10 w-full touch-manipulation bg-blue-600 hover:bg-blue-700"
          onClick={install}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Install app
        </Button>
      )}
    </div>
  );
}
