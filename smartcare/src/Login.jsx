
import { useState } from "react";
import { ArrowRight, HeartPulse, Stethoscope } from "lucide-react";
import "./Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    onLogin();
  }

  return (
    <main className="login-page">
      <section className="login-welcome">
        <div className="login-brand">
          <div className="login-brand-icon">
            <HeartPulse size={34} />
          </div>
          <span>SmartCare</span>
        </div>

        <p className="login-eyebrow">PATIENT QUEUE MANAGEMENT</p>

        <h1>Welcome to SmartCare</h1>
        <h2>Your health, our priority.</h2>

        <p className="login-description">
          A smarter way to manage patient registration, waiting queues,
          and healthcare consultations in one place.
        </p>

        <div className="login-features">
          <span>Patient registration</span>
          <span>Queue tracking</span>
          <span>Staff workspace</span>
        </div>
      </section>

      <section className="login-card">
        <div className="login-icon">
          <Stethoscope size={28} />
        </div>

        <h2>Sign in</h2>
        <p className="login-subtitle">
          Enter your details to open your workspace.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="smartcare-email">Email address</label>
          <input
            id="smartcare-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            autoComplete="username"
            required
          />

          <label htmlFor="smartcare-password">Password</label>
          <input
            id="smartcare-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-button">
            Login to SmartCare
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="login-footer">
          SmartCare Patient Queue System · Demo interface
        </p>
      </section>
    </main>
  );
}