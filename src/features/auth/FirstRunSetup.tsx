import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Col, Input, Row, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { CenteredScreen } from './CenteredScreen';
import {
  KEY_CHECK_MARKER,
  encrypt,
  generateMasterKeyBytes,
  importAesKey,
  keyBytesToMnemonic,
} from '../../services/cryptoService';
import { createKeyCheck } from '../../services/firestore/metaService';
import { useKeyStore } from '../../stores/useKeyStore';

interface FirstRunSetupProps {
  uid: string;
}

function pickConfirmIndices(count: number): number[] {
  const indices = new Set<number>();
  while (indices.size < 3) {
    indices.add(Math.floor(Math.random() * count));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function FirstRunSetup({ uid }: FirstRunSetupProps) {
  const unlock = useKeyStore((s) => s.unlock);
  const [step, setStep] = useState<'reveal' | 'confirm'>('reveal');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>({});

  const keyBytes = useMemo(() => generateMasterKeyBytes(), []);
  const mnemonic = useMemo(() => keyBytesToMnemonic(keyBytes), [keyBytes]);
  const words = useMemo(() => mnemonic.split(' '), [mnemonic]);
  const confirmIndices = useMemo(() => pickConfirmIndices(words.length), [words.length]);

  function downloadKeyFile() {
    const payload = JSON.stringify({ mnemonic, createdAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-frame-recovery-code.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleConfirm() {
    const allMatch = confirmIndices.every(
      (i) => (confirmInputs[i] ?? '').trim().toLowerCase() === words[i],
    );
    if (!allMatch) {
      setError("Those words don't match your recovery code. Check your copy and try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const cryptoKey = await importAesKey(keyBytes);
      const payload = await encrypt(cryptoKey, KEY_CHECK_MARKER);
      await createKeyCheck(uid, payload);
      await unlock(keyBytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (step === 'reveal') {
    return (
      <CenteredScreen>
        <Typography.Title level={3}>Save your recovery code</Typography.Title>
        <Typography.Paragraph>
          This 24-word code is the only way to unlock your photos on a new device. Photo Frame
          never stores it anywhere — write it down, save the key file, or both.
        </Typography.Paragraph>
        <Alert
          type="warning"
          showIcon
          message="If you lose this code, your photos are permanently unrecoverable."
          style={{ marginBottom: 16, textAlign: 'left' }}
        />
        <Row gutter={[8, 8]} style={{ marginBottom: 16, textAlign: 'left' }}>
          {words.map((word, i) => (
            <Col span={8} key={i}>
              <Typography.Text code>
                {i + 1}. {word}
              </Typography.Text>
            </Col>
          ))}
        </Row>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<DownloadOutlined />} onClick={downloadKeyFile} block>
            Download key file
          </Button>
          <Checkbox checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}>
            I have saved this code. I understand that if I lose it, my photos are gone forever.
          </Checkbox>
          <Button type="primary" disabled={!acknowledged} block onClick={() => setStep('confirm')}>
            Continue
          </Button>
        </Space>
      </CenteredScreen>
    );
  }

  return (
    <CenteredScreen>
      <Typography.Title level={3}>Confirm your recovery code</Typography.Title>
      <Typography.Paragraph>
        Type the requested words from the code you just saved.
      </Typography.Paragraph>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Space direction="vertical" style={{ width: '100%' }}>
        {confirmIndices.map((i) => (
          <Input
            key={i}
            placeholder={`Word #${i + 1}`}
            value={confirmInputs[i] ?? ''}
            onChange={(e) => setConfirmInputs((prev) => ({ ...prev, [i]: e.target.value }))}
          />
        ))}
        <Button type="primary" block loading={submitting} onClick={() => void handleConfirm()}>
          Confirm and continue
        </Button>
        <Button type="link" block onClick={() => setStep('reveal')}>
          Back
        </Button>
      </Space>
    </CenteredScreen>
  );
}
