import { useEffect, useState } from 'react';
import { Alert, Button, InputNumber, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useKeyStore } from '../../stores/useKeyStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { keyBytesToMnemonic } from '../../services/cryptoService';
import { getSettings, updateSettings } from '../../services/firestore/metaService';

export function SettingsPage() {
  const keyBytes = useKeyStore((s) => s.keyBytes);
  const uid = useAuthStore((s) => s.user?.uid);
  const [revealed, setRevealed] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    void getSettings(uid).then((settings) => setAutoLockMinutes(settings.autoLockMinutes));
  }, [uid]);

  async function handleSaveAutoLock(value: number | null) {
    if (!uid || value == null) return;
    setAutoLockMinutes(value);
    setSaving(true);
    try {
      await updateSettings(uid, { autoLockMinutes: value });
    } finally {
      setSaving(false);
    }
  }

  const mnemonic = keyBytes ? keyBytesToMnemonic(keyBytes) : null;

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Typography.Title level={3}>Settings</Typography.Title>

      <Typography.Title level={4} style={{ marginTop: 24 }}>
        Recovery code
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Re-display your 24-word recovery code. Anyone who sees it can decrypt your entire
        library — make sure no one is looking over your shoulder.
      </Typography.Paragraph>
      <Button
        icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        onClick={() => setRevealed((v) => !v)}
      >
        {revealed ? 'Hide recovery code' : 'Show recovery code'}
      </Button>
      {revealed && mnemonic && (
        <Alert
          style={{ marginTop: 16, fontFamily: 'monospace' }}
          message={mnemonic}
          type="warning"
        />
      )}

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Auto-lock
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Automatically lock Photo Frame after this many minutes of inactivity. Set to 0 to
        disable.
      </Typography.Paragraph>
      <InputNumber
        min={0}
        max={240}
        value={autoLockMinutes}
        disabled={saving}
        onChange={(v) => void handleSaveAutoLock(v)}
      />
      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
        minutes
      </Typography.Text>
    </div>
  );
}
