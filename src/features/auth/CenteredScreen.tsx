import type { PropsWithChildren } from 'react';
import { Spin } from 'antd';

export function CenteredScreen({ children }: PropsWithChildren) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>{children}</div>
    </div>
  );
}

export function FullscreenSpinner() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spin size="large" />
    </div>
  );
}
