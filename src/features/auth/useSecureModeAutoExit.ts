import { useEffect, useState } from 'react';
import { useModeStore } from '../../stores/useModeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSettings } from '../../services/firestore/metaService';
import { ACTIVITY_EVENTS } from './activityEvents';

/** Exits secure mode after `secureModeInactivityMinutes` (meta/settings) of no activity — F5. */
export function useSecureModeAutoExit() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const uid = useAuthStore((s) => s.user?.uid);
  const [minutes, setMinutes] = useState(5);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void getSettings(uid).then((settings) => {
      if (!cancelled) setMinutes(settings.secureModeInactivityMinutes);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (mode !== 'secure' || minutes <= 0) return;
    let timeoutId: number;
    function reset() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setMode('open'), minutes * 60_000);
    }
    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));
    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [mode, minutes, setMode]);
}
