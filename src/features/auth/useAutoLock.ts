import { useEffect, useState } from 'react';
import { useKeyStore } from '../../stores/useKeyStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSettings } from '../../services/firestore/metaService';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;

/** Locks the app after `autoLockMinutes` (meta/settings) of no user activity. */
export function useAutoLock() {
  const lock = useKeyStore((s) => s.lock);
  const uid = useAuthStore((s) => s.user?.uid);
  const [minutes, setMinutes] = useState(15);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void getSettings(uid).then((settings) => {
      if (!cancelled) setMinutes(settings.autoLockMinutes);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (minutes <= 0) return;
    let timeoutId: number;
    function reset() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => lock(), minutes * 60_000);
    }
    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));
    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [minutes, lock]);
}
