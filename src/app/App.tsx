import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { theme } from './theme';
import { router } from './router';

export function App() {
  return (
    <ConfigProvider theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
