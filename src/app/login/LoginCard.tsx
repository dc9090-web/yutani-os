const MESSAGES: Record<string, string> = {
  "not-allowed": "That character is not on the allow-list for this site.",
  state: "The login attempt expired or was tampered with. Please try again.",
  token: "EVE SSO did not accept the login. Please try again.",
  jwt: "EVE SSO returned a token we could not verify.",
  unknown: "Login failed. Please try again.",
};
export function LoginCard({ error }: { error: string | null }) {
  return (
    <div className="login-page">
      <div className="login-logo"><span className="logo-text">EVE</span><span className="login-wordmark">Plasma</span></div>
      <div className="login-card">
        <h1 className="login-h1">Sign in</h1>
        <p className="login-sub">Authorise one of your characters with EVE Online SSO.</p>
        {error ? <p className="login-msg" role="alert">{MESSAGES[error] ?? MESSAGES.unknown}</p> : null}
        <a className="sso-btn" href="/auth/start">Log in with EVE Online</a>
      </div>
      <p className="login-copy">Private tool · only allow-listed characters can sign in.</p>
    </div>
  );
}
