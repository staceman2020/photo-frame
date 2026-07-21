import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, List, Space, Switch, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useKeyStore } from '../../stores/useKeyStore';
import { useModeStore } from '../../stores/useModeStore';
import { ImageWorkerPool } from '../../workers/workerPool';
import { runUpload, type UploadStage } from '../../services/uploadService';
import { getDecryptedBlobUrl } from '../../services/photoBlobService';

type ItemStatus = 'queued' | UploadStage | 'duplicate' | 'rejected' | 'done' | 'failed';

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  reason?: string;
  thumbUrl?: string;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Queued',
  analyzing: 'Analyzing…',
  checking: 'Checking for duplicates…',
  processing: 'Encrypting…',
  uploading: 'Uploading…',
  finalizing: 'Finalizing…',
  duplicate: 'Duplicate — skipped',
  rejected: 'Rejected',
  done: 'Done',
  failed: 'Failed',
};

const STATUS_COLOR: Partial<Record<ItemStatus, string>> = {
  duplicate: 'gold',
  rejected: 'red',
  failed: 'red',
  done: 'green',
};

export function UploadPage() {
  const uid = useAuthStore((s) => s.user?.uid);
  const cryptoKey = useKeyStore((s) => s.cryptoKey);
  const [items, setItems] = useState<UploadItem[]>([]);
  // Default to the mode active when this page mounted (F3: "secure when
  // uploading in secure mode") — a starting point the user can still
  // override per batch, not a live binding to the mode store.
  const [secure, setSecure] = useState(() => useModeStore.getState().mode === 'secure');
  const poolRef = useRef<ImageWorkerPool | null>(null);

  useEffect(
    () => () => {
      poolRef.current?.terminate();
    },
    [],
  );

  function getPool(): ImageWorkerPool | null {
    if (!cryptoKey) return null;
    if (!poolRef.current) {
      poolRef.current = new ImageWorkerPool();
      poolRef.current.init(cryptoKey);
    }
    return poolRef.current;
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function processFile(item: UploadItem) {
    const pool = getPool();
    if (!uid || !cryptoKey || !pool) return;

    const outcome = await runUpload(item.file, {
      uid,
      secure,
      pool,
      onStage: (stage) => updateItem(item.id, { status: stage }),
    });

    if (outcome.status === 'done' && outcome.photoId) {
      updateItem(item.id, { status: 'done' });
      try {
        const url = await getDecryptedBlobUrl(uid, outcome.photoId, 'thumb', cryptoKey, 'image/jpeg');
        updateItem(item.id, { thumbUrl: url });
      } catch {
        // Leave thumbUrl unset — the list item falls back to a broken-photo
        // placeholder rather than crashing. See F2's decryption-failure
        // acceptance criterion.
      }
    } else if (outcome.status === 'duplicate') {
      updateItem(item.id, { status: 'duplicate', reason: 'Already in your library' });
    } else if (outcome.status === 'rejected') {
      updateItem(item.id, { status: 'rejected', reason: outcome.reason });
    } else {
      updateItem(item.id, { status: 'failed', reason: outcome.reason });
    }
  }

  function addFiles(files: File[]) {
    const newItems: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
    }));
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => void processFile(item));
  }

  function retry(item: UploadItem) {
    updateItem(item.id, { status: 'queued', reason: undefined });
    void processFile({ ...item, status: 'queued', reason: undefined });
  }

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    beforeUpload: (_file, fileList) => {
      addFiles(fileList);
      return false;
    },
  };

  const summary = useMemo(() => {
    const counts = { done: 0, duplicate: 0, rejected: 0, failed: 0 };
    for (const item of items) {
      if (item.status === 'done') counts.done++;
      else if (item.status === 'duplicate') counts.duplicate++;
      else if (item.status === 'rejected') counts.rejected++;
      else if (item.status === 'failed') counts.failed++;
    }
    return counts;
  }, [items]);

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Typography.Title level={3}>Upload</Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <Switch checked={secure} onChange={setSecure} />
        <Typography.Text>Mark uploads as secure</Typography.Text>
      </Space>

      <Upload.Dragger {...uploadProps} style={{ marginBottom: 24 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag photos here to upload</p>
        <p className="ant-upload-hint">
          Every file is encrypted in your browser before it ever leaves this device.
        </p>
      </Upload.Dragger>

      {items.length > 0 && (
        <>
          <Typography.Paragraph type="secondary">
            {summary.done} uploaded · {summary.duplicate} duplicates · {summary.rejected} rejected ·{' '}
            {summary.failed} failed
          </Typography.Paragraph>
          <List
            bordered
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                actions={
                  item.status === 'failed'
                    ? [
                        <Button
                          key="retry"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => retry(item)}
                        >
                          Retry
                        </Button>,
                      ]
                    : []
                }
              >
                <List.Item.Meta
                  avatar={
                    item.thumbUrl ? (
                      <img
                        src={item.thumbUrl}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, background: '#f0f0f0', borderRadius: 4 }} />
                    )
                  }
                  title={item.file.name}
                  description={
                    <Space direction="vertical" size={0}>
                      <Tag color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</Tag>
                      {item.reason && <Typography.Text type="secondary">{item.reason}</Typography.Text>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </div>
  );
}
