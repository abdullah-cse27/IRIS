
import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  UserRound,
  Smartphone,
  Sparkles,
  LockKeyhole,
  BrainCircuit,
  FileSearch,
  Zap,
} from 'lucide-react'
import { login, requestSignupOtp, verifySignupOtp, requestPasswordResetOtp, verifyPasswordResetOtp } from './api'
import './AuthPage.css'

type AuthView = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password'

interface AuthPageProps {
  onAuthenticated?: () => void
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [view, setView] = useState<AuthView>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  function switchView(nextView: AuthView) {
    setNotice('')
    setShowPassword(false)
    setView(nextView)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('')

    if (loading) return

    if ((view === 'signup' || isResetPassword) && password !== confirmPassword) {
      setNotice('Passwords do not match.')
      return
    }

    if (isOtpView && !/^\d{6}$/.test(otp)) {
      setNotice('Enter a valid 6-digit OTP.')
      return
    }

    setLoading(true)
    try {
      if (view === 'login') {
        await login({ email: email.trim(), password })
        setNotice('Login successful. Opening your workspace...')
        onAuthenticated?.()
        return
      }

      if (view === 'signup') {
        await requestSignupOtp({
          name: name.trim(),
          phone: mobile.trim(),
          email: email.trim(),
          password,
        })
        setOtp('')
        setNotice('Verification code sent to your email.')
        setView('verify-email')
        return
      }

      if (isForgotPassword) {
        await requestPasswordResetOtp(email.trim())
        setOtp('')
        setPassword('')
        setConfirmPassword('')
        setView('reset-password')
        setNotice('If an eligible account exists, a reset code has been sent. Check your inbox.')
        return
      }

      if (isResetPassword) {
        await verifyPasswordResetOtp({ email: email.trim(), otp, new_password: password })
        setOtp('')
        setPassword('')
        setConfirmPassword('')
        setView('login')
        setNotice('Password reset successfully. Please sign in with your new password.')
        return
      }

      await verifySignupOtp({ email: email.trim(), otp })
      setPassword('')
      setConfirmPassword('')
      setOtp('')
      setView('login')
      setNotice('Email verified successfully. Please sign in.')
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (loading) return
    setLoading(true)
    setNotice('')
    try {
      await requestSignupOtp({
        name: name.trim(),
        phone: mobile.trim(),
        email: email.trim(),
        password,
      })
      setNotice('A new verification code has been sent to your email.')
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not resend the verification code.',
      )
    } finally {
      setLoading(false)
    }
  }

  const isSignup = view === 'signup'
  const isLogin = view === 'login'
  const isVerify = view === 'verify-email'
  const isForgotPassword = view === 'forgot-password'
  const isResetPassword = view === 'reset-password'
  const isOtpView = isVerify || isResetPassword

  return (
    <main className={`auth-page auth-view-${view}`}>
      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />
      <div className="auth-grid-texture" aria-hidden="true" />

      {/* Left: IRIS introduction */}
      <section className="auth-showcase">
        <div className="showcase-top">
          <div className="showcase-brand">
            <div className="showcase-logo" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M5 32Q32 5 59 32Q32 59 5 32Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2" />
                <circle cx="32" cy="32" r="8" fill="currentColor" />
                <circle cx="35" cy="29" r="3" fill="#fff" />
              </svg>
            </div>
            <div>
              <h1>IRIS<span className="brand-period">.</span></h1>
              <p>INTELLIGENT RETRIEVAL &amp; INSIGHT SYSTEM</p>
            </div>
          </div>

          <div className="showcase-status">
            <span className="status-dot" />
            PRIVATE KNOWLEDGE SPACE
          </div>
        </div>

        <div className="showcase-content">
          <div className="showcase-copy">
            <div className="showcase-eyebrow">
              <Sparkles size={14} />
              YOUR KNOWLEDGE, REIMAGINED
            </div>

            <h2>
              Your documents.
              <br />
              <span>Your intelligence.</span>
              <br />
              One space.
            </h2>

            <p className="showcase-description">
              Turn scattered documents into a searchable knowledge space.
              Ask questions, discover insights, and find the answers that matter.
            </p>

            <div className="showcase-features">
              <div className="showcase-feature">
                <span className="feature-icon">
                  <FileSearch size={17} />
                </span>
                <span>
                  <strong>Smart retrieval</strong>
                  <small>Find relevant information faster</small>
                </span>
              </div>

              <div className="showcase-feature">
                <span className="feature-icon">
                  <BrainCircuit size={17} />
                </span>
                <span>
                  <strong>Context-aware answers</strong>
                  <small>Ask questions about your documents</small>
                </span>
              </div>

              <div className="showcase-feature">
                <span className="feature-icon">
                  <ShieldCheck size={17} />
                </span>
                <span>
                  <strong>Your private workspace</strong>
                  <small>Built with privacy in mind</small>
                </span>
              </div>
            </div>
          </div>

          <div className="iris-visual" aria-hidden="true">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-orbit orbit-three" />

            <div className="visual-core">
              <div className="visual-core-inner">
                <svg viewBox="0 0 100 100" fill="none">
                  <path
                    d="M8 50Q50 8 92 50Q50 92 8 50Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="50" cy="50" r="23" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="50" cy="50" r="13" fill="currentColor" />
                  <circle cx="55" cy="45" r="5" fill="#fff" />
                </svg>
              </div>
            </div>

            <span className="visual-particle particle-one" />
            <span className="visual-particle particle-two" />
            <span className="visual-particle particle-three" />
            <span className="visual-particle particle-four" />

            <div className="visual-caption">
              <span className="caption-line" />
              <span>KNOWLEDGE, CONNECTED</span>
            </div>
          </div>
        </div>

        <div className="showcase-bottom">
          <span>THINK CLEARER. FIND FASTER.</span>
          <span className="showcase-version">
            <span className="status-dot" />
            IRIS WORKSPACE
          </span>
        </div>
      </section>

      {/* Right: Authentication */}
      <section className="auth-panel">
        <div className="auth-panel-glow" aria-hidden="true" />

        <div className="auth-card">
          <div className="auth-mobile-brand">
            <div className="auth-logo" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M5 32Q32 5 59 32Q32 59 5 32Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2" />
                <circle cx="32" cy="32" r="8" fill="currentColor" />
                <circle cx="35" cy="29" r="3" fill="#fff" />
              </svg>
            </div>
            <div>
              <strong>IRIS</strong>
              <small>YOUR KNOWLEDGE SPACE</small>
            </div>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">
              <ShieldCheck size={14} />
              {isOtpView ? 'VERIFY YOUR IDENTITY' : isForgotPassword ? 'ACCOUNT RECOVERY' : 'YOUR KNOWLEDGE, PROTECTED'}
            </span>

            <h2>
              {isLogin
                ? 'Welcome back'
                : isSignup
                  ? 'Create your account'
                  : isForgotPassword
                    ? 'Forgot password?'
                    : isResetPassword
                      ? 'Reset your password'
                      : 'Verify your email'}
            </h2>

            <p>
              {isLogin
                ? 'Sign in to continue to your knowledge space.'
                : isSignup
                  ? 'Create your personal IRIS workspace.'
                  : isForgotPassword
                    ? 'Enter your account email to receive a password reset code.'
                    : isResetPassword || isVerify
                      ? `Enter the 6-digit code sent to ${email || 'your email'}.`
                      : 'Secure your account with a new password.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <label htmlFor="auth-name">Full name</label>
                <div className="auth-input-wrap">
                  <UserRound size={17} aria-hidden="true" />
                  <input
                    id="auth-name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <label htmlFor="auth-mobile">Mobile number</label>
                <div className="auth-input-wrap">
                  <Smartphone size={17} aria-hidden="true" />
                  <input
                    id="auth-mobile"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    pattern="[0-9+() -]{8,18}"
                    required
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder="Your mobile number"
                  />
                </div>
              </>
            )}

            {(!isOtpView || isResetPassword) && (
              <>
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={17} aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {(isLogin || isSignup || isResetPassword) && (
                  <>
                <label htmlFor="auth-password">{isResetPassword ? 'New password' : 'Password'}</label>
                <div className="auth-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {isLogin && (
                  <div className="auth-forgot-row">
                    <button className="auth-text-button" type="button" onClick={() => switchView('forgot-password')}>Forgot password?</button>
                  </div>
                )}
                  </>
                )}
              </>
            )}

            {(isSignup || isResetPassword) && (
              <>
                <label htmlFor="auth-confirm-password">Confirm new password</label>
                <div className="auth-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter password again"
                  />
                </div>
              </>
            )}

            {isOtpView && (
              <>
                <label htmlFor="auth-otp">6-digit verification code</label>
                <div className="auth-input-wrap">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <input
                    id="auth-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                  />
                </div>

                <button
                  className="auth-text-button"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (isResetPassword) {
                      setLoading(true)
                      setNotice('')
                      void requestPasswordResetOtp(email.trim())
                        .then(() => setNotice('If an eligible account exists, a reset code has been sent. Check your inbox.'))
                        .catch((error) => setNotice(error instanceof Error ? error.message : 'Could not request another code.'))
                        .finally(() => setLoading(false))
                    } else {
                      void handleResendOtp()
                    }
                  }}
                >
                  Resend code
                </button>
              </>
            )}

            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              <span>
                {loading
                  ? 'Please wait...'
                  : isLogin
                    ? 'Sign in'
                    : isSignup
                      ? 'Create account'
                      : isForgotPassword
                        ? 'Send reset code'
                        : isResetPassword
                          ? 'Reset password'
                          : 'Verify email'}
              </span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="auth-switch">
            {isLogin ? (
              <>
                New to IRIS?{' '}
                <button type="button" onClick={() => switchView('signup')}>
                  Create an account
                </button>
              </>
            ) : isSignup ? (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => switchView('login')}>
                  Sign in
                </button>
              </>
            ) : isForgotPassword || isResetPassword ? (
              <button type="button" onClick={() => { setOtp(''); setPassword(''); setConfirmPassword(''); switchView('login') }}>
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOtp('')
                  switchView('signup')
                }}
              >
                Back to signup
              </button>
            )}
          </div>

          <div className="auth-footer">
            <ShieldCheck size={14} />
            <span>Your knowledge deserves a private space.</span>
          </div>
        </div>

        <div className="auth-panel-bottom">
          <span><Zap size={12} /> BUILT FOR YOUR WORKFLOW</span>
          <span>IRIS · INTELLIGENT BY DESIGN</span>
        </div>
      </section>
    </main>
  )
}
