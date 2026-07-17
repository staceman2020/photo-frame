import type { FirestoreError } from 'firebase/firestore';

export function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as FirestoreError).code === 'permission-denied'
  );
}
