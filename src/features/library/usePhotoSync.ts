import { useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePhotoStore } from '../../stores/usePhotoStore';

/** Subscribes/unsubscribes the photo listener as the signed-in user changes. */
export function usePhotoSync(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const subscribe = usePhotoStore((s) => s.subscribe);
  const reset = usePhotoStore((s) => s.reset);

  useEffect(() => {
    if (!uid) {
      reset();
      return;
    }
    subscribe(uid);
    return () => reset();
  }, [uid, subscribe, reset]);
}
