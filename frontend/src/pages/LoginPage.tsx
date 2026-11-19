import { ArrowRight, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError, defaultFacilityId } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Notice } from "../components/ui";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const facilityId = defaultFacilityId.trim();

  if (!loading && user) return <Navigate to="/app/worklist" replace />;
  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-loading">Checking your session…</div>
      </main>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!facilityId) return;
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password, facilityId);
      navigate("/app/worklist", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <img src="/assets/5c-networks-logo.png" alt="" />
          </div>
          <span>
            <strong>5C Networks</strong>
            <small>Imaging workflow</small>
          </span>
        </div>
        <div className="auth-heading">
          <span className="auth-icon"><LockKeyhole size={18} /></span>
          <p className="eyebrow">Secure staff access</p>
          <h1>Welcome back</h1>
          <p>Sign in to manage your imaging workflow.</p>
        </div>
        {error && <Notice>{error}</Notice>}
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>Work email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@5cnetwork.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button
            className="button button-primary button-full"
            disabled={submitting || !facilityId}
          >
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>
        <p className="auth-footnote">
          Access is restricted to authorized 5C Networks staff.
        </p>
      </section>
    </main>
  );
}
