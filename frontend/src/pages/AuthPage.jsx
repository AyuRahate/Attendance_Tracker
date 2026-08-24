import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/today');
      } else {
        await register(email, password, name);
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fadeIn">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 2L28 8.9282V23.0718L16 30L4 23.0718V8.9282L16 2Z"
                fill="url(#auth-logo-grad)"
                stroke="#818cf8"
                strokeWidth="1.5"
              />
              <circle cx="16" cy="16" r="5" fill="#ffffff" />
              <defs>
                <linearGradient id="auth-logo-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#4338ca" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-xl font-extrabold gradient-text">AttendAI</h1>
          <p className="text-sm text-secondary mt-2">
            Track attendance. Know when you can skip. Never stress about percentages.
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '24px' }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: 'calc(var(--radius-md) - 2px)',
                border: 'none',
                background: mode === m ? 'var(--color-primary)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'all var(--duration)',
                fontFamily: 'inherit',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Arjun Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'login'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder={mode === 'login' ? '••••••••' : 'At least 6 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '8px' }}
            disabled={loading}
          >
            {loading
              ? mode === 'login' ? 'Signing in...' : 'Creating account...'
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        {/* Info blurb */}
        <p className="text-muted text-xs text-center mt-6" style={{ lineHeight: 1.6 }}>
          Your personal attendance tracker &mdash; log lectures,<br />monitor progress, and plan your schedule.
        </p>
      </div>
    </div>
  );
}
