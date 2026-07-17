import { Alert, Button, Typography } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { CenteredScreen } from './CenteredScreen';

interface SignInPageProps {
  onSignIn: () => void;
  error: string | null;
}

export function SignInPage({ onSignIn, error }: SignInPageProps) {
  return (
    <CenteredScreen>
      <Typography.Title level={2}>Photo Frame</Typography.Title>
      <Typography.Paragraph type="secondary">
        A private, encrypted photo library. Sign in with the owner account to continue.
      </Typography.Paragraph>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Button type="primary" size="large" icon={<GoogleOutlined />} onClick={onSignIn}>
        Sign in with Google
      </Button>
    </CenteredScreen>
  );
}
