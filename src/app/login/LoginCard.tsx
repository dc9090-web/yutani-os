const MESSAGES: Record<string, string> = {
  "not-allowed": "That Google account is not allowed on this site.",
  cancelled: "Sign-in was cancelled.",
  state: "The sign-in attempt expired or was tampered with. Please try again.",
  token: "Google did not accept the sign-in. Please try again.",
  jwt: "Google returned a sign-in we could not verify.",
  unknown: "Sign-in failed. Please try again.",
};
export function LoginCard({ error }: { error: string | null }) {
  return (
    <div className="login-page">
      <div className="login-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/yutani/wordmark-white.png" alt="Yutani" className="login-logo-img" />
        <span className="login-wordmark">OS</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/yutani/kana-white.png" alt="ユタニ重工" className="login-kana" />
      </div>
      <div className="login-card">
        <h1 className="login-h1">Sign in</h1>
        <p className="login-sub">Sign in with the Google account this site is set up for.</p>
        {error ? <p className="login-msg" role="alert">{MESSAGES[error] ?? MESSAGES.unknown}</p> : null}
        <a className="sso-btn" href="/auth/google/start">Sign in with Google</a>
      </div>
      <p className="login-copy">Private tool · only the owner&apos;s Google account can sign in.</p>
    </div>
  );
}
