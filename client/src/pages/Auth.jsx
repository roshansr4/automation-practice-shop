import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Field, Spinner } from '../components.jsx';

function PasswordField({ label, value, onChange, error, name = 'password' }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} name={name} error={error}>
      <div className="password-field">
        <input
          id={`field-${name}`}
          name={name}
          type={visible ? 'text' : 'password'}
          className="field__input"
          autoComplete="current-password"
          value={value}
          onChange={onChange}
        />
        <button type="button" className="password-field__toggle" onClick={() => setVisible((current) => !current)}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  );
}

export function Login() {
  const { login } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login({ email: form.email, password: form.password });
      navigate('/orders');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <h1>Sign in</h1>
        <p className="auth__lead">Use one of the demo accounts, or make your own.</p>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <PasswordField
            label="Password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={(event) => setForm({ ...form, remember: event.target.checked })}
            />
            <span>Keep me signed in</span>
          </label>

          <button type="submit" className="button button--large" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          {busy && <Spinner label="Verifying credentials" />}
        </form>

        <p className="auth__switch">
          No account yet? <Link to="/register">Create one</Link>
        </p>

        <table className="auth__accounts">
          <caption>Seeded accounts</caption>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Password</th>
              <th scope="col">Behaviour</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>demo@practice.dev</td>
              <td>Password123!</td>
              <td>Signs in normally</td>
            </tr>
            <tr>
              <td>admin@practice.dev</td>
              <td>Admin123!</td>
              <td>Unlocks the admin tools</td>
            </tr>
            <tr>
              <td>locked@practice.dev</td>
              <td>Password123!</td>
              <td>Always returns a locked-account error</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Register() {
  const { register } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'What should we call you?';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'At least 8 characters, please.';
    if (form.password !== form.confirm) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/');
    } catch (registerError) {
      setErrors({ email: registerError.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <h1>Create an account</h1>
        <form onSubmit={submit} noValidate>
          <Field
            label="Full name"
            name="name"
            value={form.name}
            error={errors.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <PasswordField
            label="Password"
            name="newPassword"
            value={form.password}
            error={errors.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            value={form.confirm}
            error={errors.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />
          <button type="submit" className="button button--large" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="auth__switch">
          Already registered? <Link to="/login">Sign in instead</Link>
        </p>
      </div>
    </section>
  );
}

export default Login;
