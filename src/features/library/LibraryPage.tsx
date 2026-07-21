import { useState } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { Button, Empty, Modal, Space, Spin, Typography } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useKeyStore } from '../../stores/useKeyStore';
import { useModeStore } from '../../stores/useModeStore';
import { usePhotoStore } from '../../stores/usePhotoStore';
import { useVisiblePhotos } from '../../stores/selectors';
import { deletePhoto, setPhotoSecure } from '../../services/photoService';
import { PhotoGridItem } from './PhotoGridItem';
import './library.css';

export function LibraryPage() {
  const uid = useAuthStore((s) => s.user?.uid);
  const cryptoKey = useKeyStore((s) => s.cryptoKey);
  const mode = useModeStore((s) => s.mode);
  const status = usePhotoStore((s) => s.status);
  const photos = useVisiblePhotos();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  async function handleDelete() {
    if (!uid) return;
    const ids = Array.from(selected);
    Modal.confirm({
      title: `Delete ${ids.length} photo${ids.length > 1 ? 's' : ''}?`,
      content: 'This permanently removes the photo and cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        setBusy(true);
        try {
          await Promise.allSettled(ids.map((id) => deletePhoto(uid, id)));
        } finally {
          setBusy(false);
          clearSelection();
        }
      },
    });
  }

  async function handleSetSecure(secure: boolean) {
    if (!uid) return;
    const ids = Array.from(selected);
    setBusy(true);
    try {
      await Promise.allSettled(ids.map((id) => setPhotoSecure(uid, id, secure)));
    } finally {
      setBusy(false);
      clearSelection();
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description={mode === 'secure' ? 'No photos yet' : 'No photos yet — try Upload'} />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Typography.Text type="secondary">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </Typography.Text>
        <Space>
          {selected.size > 0 ? (
            <>
              {mode === 'secure' && (
                <>
                  <Button
                    size="small"
                    icon={<EyeInvisibleOutlined />}
                    disabled={busy}
                    onClick={() => void handleSetSecure(true)}
                  >
                    Mark secure
                  </Button>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    disabled={busy}
                    onClick={() => void handleSetSecure(false)}
                  >
                    Mark open
                  </Button>
                </>
              )}
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
              <Button size="small" disabled={busy} onClick={clearSelection}>
                Clear selection
              </Button>
            </>
          ) : (
            <Button size="small" onClick={selectAll}>
              Select all
            </Button>
          )}
        </Space>
      </div>

      {uid && cryptoKey && (
        <VirtuosoGrid
          useWindowScroll
          totalCount={photos.length}
          listClassName="library-grid"
          itemClassName="library-grid-item"
          itemContent={(index) => {
            const photo = photos[index];
            return (
              <PhotoGridItem
                key={photo.id}
                photo={photo}
                uid={uid}
                cryptoKey={cryptoKey}
                selected={selected.has(photo.id)}
                showSecureBadge={mode === 'secure'}
                onToggleSelect={() => toggleSelect(photo.id)}
              />
            );
          }}
        />
      )}
    </div>
  );
}
