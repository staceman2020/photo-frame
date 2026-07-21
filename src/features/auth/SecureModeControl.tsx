import { useState } from 'react';
import { Alert, Button, Input, Modal, Space } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useModeStore } from '../../stores/useModeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSettings, updateSettings } from '../../services/firestore/metaService';
import { generateSaltHex, hashPin } from '../../services/pinService';

/**
 * Entering secure mode: F5's PIN is meant to be set during onboarding (F1),
 * which doesn't exist yet in this app, so this creates the PIN on first use
 * instead and verifies it on every entry after that. Exiting never requires
 * the PIN — see ARCHITECTURE.md §6.2.
 */
export function SecureModeControl() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const uid = useAuthStore((s) => s.user?.uid);

  const [modalOpen, setModalOpen] = useState(false);
  const [pinFlow, setPinFlow] = useState<'verify' | 'create'>('verify');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function openGate() {
    if (!uid) return;
    setError(null);
    setPin('');
    setConfirmPin('');
    const settings = await getSettings(uid);
    setPinFlow(settings.securePinHash ? 'verify' : 'create');
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!uid) return;
    setSubmitting(true);
    setError(null);
    try {
      if (pinFlow === 'create') {
        if (pin.length < 4) throw new Error('PIN must be at least 4 digits.');
        if (pin !== confirmPin) throw new Error('PINs do not match.');
        const salt = generateSaltHex();
        const hash = await hashPin(pin, salt);
        await updateSettings(uid, { securePinHash: hash, securePinSalt: salt });
      } else {
        const settings = await getSettings(uid);
        const hash = await hashPin(pin, settings.securePinSalt ?? '');
        if (hash !== settings.securePinHash) throw new Error('Incorrect PIN.');
      }
      setMode('secure');
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'secure') {
    return (
      <Button icon={<UnlockOutlined />} onClick={() => setMode('open')}>
        Exit secure mode
      </Button>
    );
  }

  return (
    <>
      <Button icon={<LockOutlined />} onClick={() => void openGate()}>
        Secure mode
      </Button>
      <Modal
        title={pinFlow === 'create' ? 'Create a secure PIN' : 'Enter secure PIN'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        okText={pinFlow === 'create' ? 'Create and enter' : 'Unlock'}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {error && <Alert type="error" message={error} showIcon />}
          {pinFlow === 'create' && (
            <Alert
              type="info"
              showIcon
              message="This PIN hides secure photos from casual browsing — it's not encryption. See Settings for details."
            />
          )}
          <Input.Password
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onPressEnter={() => void handleSubmit()}
            autoFocus
          />
          {pinFlow === 'create' && (
            <Input.Password
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              onPressEnter={() => void handleSubmit()}
            />
          )}
        </Space>
      </Modal>
    </>
  );
}
