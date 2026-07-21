import { useMemo } from 'react';
import { usePhotoStore, type PhotoDoc } from './usePhotoStore';
import { useModeStore } from './useModeStore';

/** Mode-aware by construction — open mode never returns secure photos. See ARCHITECTURE.md §6.2/§8. */
export function useVisiblePhotos(): PhotoDoc[] {
  const photos = usePhotoStore((s) => s.photos);
  const mode = useModeStore((s) => s.mode);
  return useMemo(() => (mode === 'secure' ? photos : photos.filter((p) => !p.secure)), [photos, mode]);
}
