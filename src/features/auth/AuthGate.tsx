import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useKeyStore } from '../../stores/useKeyStore';
import { getKeyCheck } from '../../services/firestore/metaService';
import { isPermissionDenied } from '../../services/firestore/errors';
import {
  clearStoredKeyBytes,
  decrypt,
  importAesKey,
  readStoredKeyBytes,
} from '../../services/cryptoService';
import { SignInPage } from './SignInPage';
import { AccessDeniedPage } from './AccessDeniedPage';
import { FirstRunSetup } from './FirstRunSetup';
import { KeyEntryPage } from './KeyEntryPage';
import { CenteredScreen, FullscreenSpinner } from './CenteredScreen';

type AccountState = 'checking' | 'ok' | 'denied' | 'error';

export function AuthGate({ children }: { children: ReactNode }) {
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const authError = useAuthStore((s) => s.error);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const keyStatus = useKeyStore((s) => s.status);
  const unlock = useKeyStore((s) => s.unlock);

  const [accountState, setAccountState] = useState<AccountState>('checking');
  const [keyCheckExists, setKeyCheckExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAccountState('checking');
    setKeyCheckExists(null);

    (async () => {
      try {
        const keyCheck = await getKeyCheck(user.uid);
        if (cancelled) return;
        setAccountState('ok');
        setKeyCheckExists(keyCheck !== null);

        if (keyCheck) {
          const stored = readStoredKeyBytes();
          if (stored) {
            try {
              const cryptoKey = await importAesKey(stored);
              await decrypt(cryptoKey, keyCheck);
              await unlock(stored, { persist: false });
            } catch {
              // Stored key doesn't match this account's key-check token
              // (stale/corrupted localStorage) — fall through to key entry.
              clearStoredKeyBytes();
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        setAccountState(isPermissionDenied(err) ? 'denied' : 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, unlock]);

  if (authStatus === 'loading') return <FullscreenSpinner />;
  if (!user) return <SignInPage onSignIn={() => void signInWithGoogle()} error={authError} />;
  if (accountState === 'checking') return <FullscreenSpinner />;
  if (accountState === 'denied') return <AccessDeniedPage />;
  if (accountState === 'error') {
    return (
      <CenteredScreen>
        Something went wrong loading your account. Please refresh the page.
      </CenteredScreen>
    );
  }

  if (keyStatus !== 'unlocked') {
    return keyCheckExists ? <KeyEntryPage uid={user.uid} /> : <FirstRunSetup uid={user.uid} />;
  }

  return <>{children}</>;
}
