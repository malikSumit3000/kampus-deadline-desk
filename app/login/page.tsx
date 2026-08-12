import GoogleSignInButton from "./GoogleSignInButton";
import ThemeToggle from "../ThemeToggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-tools"><ThemeToggle /></div>
        <span className="brand-mark">K</span>
        <p className="eyebrow">Kampus deadline desk</p>
        <h1>Your deadlines, personally organised.</h1>
        <p>Sign in with your verified IIMK Google account. Gmail access is optional and requested separately after sign-in.</p>
        {error && <div className="warning-strip" role="alert">{error}</div>}
        <GoogleSignInButton />
        <small>Only exact @iimk.ac.in accounts can enter the pilot.</small>
      </section>
    </main>
  );
}
