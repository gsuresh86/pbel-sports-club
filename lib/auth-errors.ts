export function authErrorMessage(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/account-exists-with-different-credential':
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Sign in with the method you used first.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'The browser blocked the Google window. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for Google sign-in yet.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Failed to sign in. Please check your credentials.';
    default:
      return error instanceof Error && error.message ? error.message : fallback;
  }
}
