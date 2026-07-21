import { useEffect, useState } from 'react';
import { Checkbox, Image, Spin, Tag } from 'antd';
import { getDecryptedBlobUrl } from '../../services/photoBlobService';
import type { PhotoDoc } from '../../stores/usePhotoStore';

interface PhotoGridItemProps {
  photo: PhotoDoc;
  uid: string;
  cryptoKey: CryptoKey;
  selected: boolean;
  showSecureBadge: boolean;
  onToggleSelect: () => void;
}

export function PhotoGridItem({
  photo,
  uid,
  cryptoKey,
  selected,
  showSecureBadge,
  onToggleSelect,
}: PhotoGridItemProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setThumbUrl(null);
    setDisplayUrl(null);
    setBroken(false);

    getDecryptedBlobUrl(uid, photo.id, 'thumb', cryptoKey, 'image/jpeg')
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBroken(true);
      });

    getDecryptedBlobUrl(uid, photo.id, 'display', cryptoKey, 'image/jpeg')
      .then((url) => {
        if (!cancelled) setDisplayUrl(url);
      })
      .catch(() => {
        // The thumb may still decrypt fine even if the display variant is
        // corrupt — the preview just falls back to the thumb resolution.
      });

    return () => {
      cancelled = true;
    };
  }, [uid, photo.id, cryptoKey]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Checkbox
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleSelect}
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          zIndex: 1,
          background: '#fff',
          borderRadius: 4,
          padding: 2,
        }}
      />
      {showSecureBadge && photo.secure && (
        <Tag color="purple" style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }}>
          Secure
        </Tag>
      )}
      {broken ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff1f0',
            color: '#cf1322',
            fontSize: 12,
            textAlign: 'center',
            padding: 8,
          }}
        >
          Unable to decrypt
        </div>
      ) : thumbUrl ? (
        <Image
          src={thumbUrl}
          preview={{ src: displayUrl ?? thumbUrl }}
          width="100%"
          height="100%"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
          }}
        >
          <Spin size="small" />
        </div>
      )}
    </div>
  );
}
