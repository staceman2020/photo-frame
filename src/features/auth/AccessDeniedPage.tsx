import { Button, Result } from 'antd';
import { useAuthStore } from '../../stores/useAuthStore';

export function AccessDeniedPage() {
  const signOutUser = useAuthStore((s) => s.signOutUser);
  return (
    <Result
      status="403"
      title="This account isn't authorized"
      subTitle="Photo Frame is a single-owner app restricted to one Google account. Sign out and sign in with the owner account."
      extra={
        <Button type="primary" onClick={() => void signOutUser()}>
          Sign out
        </Button>
      }
    />
  );
}
