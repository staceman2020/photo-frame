import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { theme } from './theme';
import { router } from './router';
import { AuthGate } from '../features/auth/AuthGate';

export function App() {
  return (
    <ConfigProvider theme={theme}>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </ConfigProvider>
  );
}
