import { useState } from 'react';
import { Alert, Button, Input, Space, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { CenteredScreen } from './CenteredScreen';
import { decrypt, importAesKey, mnemonicToKeyBytes } from '../../services/cryptoService';
import { getKeyCheck } from '../../services/firestore/metaService';
import { useKeyStore } from '../../stores/useKeyStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface KeyEntryPageProps {
  uid: string;
}

export function KeyEntryPage({ uid }: KeyEntryPageProps) {
  const unlock = useKeyStore((s) => s.unlock);
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUnlock() {
    setError(null);
    setSubmitting(true);
    try {
      const keyBytes = mnemonicToKeyBytes(mnemonicInput);
      const cryptoKey = await importAesKey(keyBytes);
      const keyCheck = await getKeyCheck(uid);
      if (!keyCheck) throw new Error('No recovery data found for this account.');
      await decrypt(cryptoKey, keyCheck);
      await unlock(keyBytes);
    } catch {
      setError('That recovery code is incorrect.');
    } finally {
      setSubmitting(false);
    }
  }

  const uploadProps: UploadProps = {
    accept: '.json',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result)) as { mnemonic?: string };
          if (data.mnemonic) {
            setMnemonicInput(data.mnemonic);
            setError(null);
          }
        } catch {
          setError('Could not read that key file.');
        }
      };
      reader.readAsText(file);
      return false;
    },
  };

  return (
    <CenteredScreen>
      <Typography.Title level={3}>Enter your recovery code</Typography.Title>
      <Typography.Paragraph type="secondary">
        Paste your 24-word recovery code to unlock Photo Frame on this device.
      </Typography.Paragraph>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.TextArea
          rows={3}
          placeholder="word1 word2 word3 ..."
          value={mnemonicInput}
          onChange={(e) => setMnemonicInput(e.target.value)}
        />
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} block>
            Or upload key file
          </Button>
        </Upload>
        <Button type="primary" block loading={submitting} onClick={() => void handleUnlock()}>
          Unlock
        </Button>
        <Button type="link" block onClick={() => void signOutUser()}>
          Sign out
        </Button>
      </Space>
    </CenteredScreen>
  );
}
