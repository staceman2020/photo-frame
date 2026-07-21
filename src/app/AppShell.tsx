import { Button, Layout, Menu, Space, Typography } from 'antd';
import { LockOutlined, LogoutOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useKeyStore } from '../stores/useKeyStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useModeStore } from '../stores/useModeStore';
import { useAutoLock } from '../features/auth/useAutoLock';
import { useSecureModeAutoExit } from '../features/auth/useSecureModeAutoExit';
import { SecureModeControl } from '../features/auth/SecureModeControl';
import { usePhotoSync } from '../features/library/usePhotoSync';

const NAV_ITEMS = [
  { key: '/', label: 'Library' },
  { key: '/upload', label: 'Upload' },
  { key: '/tags', label: 'Tags' },
  { key: '/layouts', label: 'Layouts' },
  { key: '/filters', label: 'Filters' },
  { key: '/slideshow', label: 'Slideshow' },
  { key: '/settings', label: 'Settings' },
];

export function AppShell() {
  const lock = useKeyStore((s) => s.lock);
  const signOutUser = useAuthStore((s) => s.signOutUser);
  const mode = useModeStore((s) => s.mode);
  const navigate = useNavigate();
  const location = useLocation();
  useAutoLock();
  useSecureModeAutoExit();
  usePhotoSync();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: mode === 'secure' ? '#391085' : undefined,
        }}
      >
        <Typography.Title level={4} style={{ color: '#fff', margin: 0, marginRight: 24 }}>
          Photo Frame
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, background: 'transparent' }}
        />
        <Space>
          <SecureModeControl />
          <Button icon={<LockOutlined />} onClick={lock}>
            Lock
          </Button>
          <Button icon={<LogoutOutlined />} onClick={() => void signOutUser()}>
            Sign out
          </Button>
        </Space>
      </Layout.Header>
      <Layout.Content>
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
