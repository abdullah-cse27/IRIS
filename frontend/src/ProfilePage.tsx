import { useState, type FormEvent } from 'react'
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, KeyRound, Mail,
  Save, ShieldCheck, UserRound, Phone, ChevronRight, LoaderCircle, LogOut,
} from 'lucide-react'
import {
  requestEmailChangeOtp, requestPasswordChangeOtp, updateProfile,
  verifyEmailChangeOtp, verifyPasswordChangeOtp, type AuthUser,
} from './api'
import './ProfilePage.css'

type Props = { user: AuthUser; onBack: () => void; onUserUpdated: (user: AuthUser) => void; onLogout: () => void; loggingOut: boolean; error?: string }
type Section = 'personal' | 'email' | 'password'

export default function ProfilePage({ user, onBack, onUserUpdated, onLogout, loggingOut }: Props) {
  const [section, setSection] = useState<Section>('personal')
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone)
  const [newEmail, setNewEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordOtp, setPasswordOtp] = useState('')
  const [passwordOtpSent, setPasswordOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice(''); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.') } finally { setBusy(false) }
  }
  const chooseSection = (next: Section) => { setSection(next); setNotice(''); setError('') }
  const savePersonal = (e: FormEvent) => { e.preventDefault(); void run(async () => { const updated = await updateProfile({ name: name.trim(), phone: phone.trim() }); onUserUpdated(updated); setNotice('Your personal details have been saved.') }) }
  const sendEmailOtp = (e: FormEvent) => { e.preventDefault(); void run(async () => { const result = await requestEmailChangeOtp(newEmail.trim()); setEmailOtpSent(true); setNotice(result.message) }) }
  const verifyEmail = (e: FormEvent) => { e.preventDefault(); void run(async () => { const updated = await verifyEmailChangeOtp({ new_email: newEmail.trim(), otp: emailOtp }); onUserUpdated(updated); setEmailOtpSent(false); setEmailOtp(''); setNewEmail(''); setNotice('Your email address has been updated.') }) }
  const sendPasswordOtp = () => { void run(async () => { const result = await requestPasswordChangeOtp(); setPasswordOtpSent(true); setNotice(result.message) }) }
  const changePassword = (e: FormEvent) => { e.preventDefault(); if (newPassword !== confirmPassword) { setError('The passwords do not match.'); return } void run(async () => { const result = await verifyPasswordChangeOtp({ otp: passwordOtp, new_password: newPassword }); setNotice(result.message); setPasswordOtp(''); setNewPassword(''); setConfirmPassword(''); setPasswordOtpSent(false) }) }
  const sections = [
    { id: 'personal' as const, icon: UserRound, title: 'Personal details', subtitle: 'Name and phone number' },
    { id: 'email' as const, icon: Mail, title: 'Email address', subtitle: 'Change your sign-in email' },
    { id: 'password' as const, icon: KeyRound, title: 'Password & security', subtitle: 'Keep your account secure' },
  ]

  return <main className="profile-page"><div className="profile-shell">
    <header className="profile-topbar"><button type="button" className="profile-back" onClick={onBack}><ArrowLeft size={17}/> <span>Back to workspace</span></button><div className="profile-topbar-right"><span className="profile-status-dot"/> Account settings <span className="profile-topbar-divider">/</span> IRIS</div></header>
    <section className="profile-heading"><div className="profile-heading-copy"><div className="profile-eyebrow"><ShieldCheck size={15}/> YOUR ACCOUNT</div><h1>Personal information</h1><p>Manage your details and keep your account up to date.</p></div><div className="profile-secure-chip"><ShieldCheck size={16}/> Private account</div></section>
    <section className="profile-identity"><div className="profile-avatar">{(user.name?.trim()[0] || user.email[0]).toUpperCase()}</div><div className="profile-identity-copy"><h2>{user.name || 'IRIS user'}</h2><p>{user.email}</p></div><div className="profile-verified"><CheckCircle2 size={15}/> Email verified</div></section>
    <div className="profile-layout"><nav className="profile-nav" aria-label="Account settings"><div className="profile-nav-label">SETTINGS</div>
      {sections.map(({ id, icon: Icon, title, subtitle }) => <button key={id} type="button" onClick={() => chooseSection(id)} className={`profile-nav-item ${section === id ? 'is-active' : ''}`}><span className="profile-nav-icon"><Icon size={18}/></span><span className="profile-nav-text"><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight size={16} className="profile-nav-chevron"/></button>)}
      <div className="profile-nav-foot"><ShieldCheck size={16}/><span>Your account details are only available to you.</span></div><button type="button" className="profile-logout" onClick={onLogout} disabled={loggingOut}>{loggingOut ? <LoaderCircle size={17} className="profile-spin"/> : <LogOut size={17}/>} {loggingOut ? 'Logging out…' : 'Log out'}</button>
    </nav><section className="profile-content">
      {section === 'personal' && <><div className="profile-content-heading"><div className="profile-content-icon"><UserRound size={19}/></div><div><h2>Personal details</h2><p>These details help personalise your IRIS workspace.</p></div></div><form className="profile-form" onSubmit={savePersonal}>
        <label className="profile-field"><span>Full name</span><div className="profile-input-wrap"><UserRound size={17}/><input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name"/></div></label>
        <label className="profile-field"><span>Phone number</span><div className="profile-input-wrap"><Phone size={17}/><input required maxLength={40} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter your phone number"/></div></label>
        <label className="profile-field"><span>Email address <em>Managed separately</em></span><div className="profile-input-wrap is-readonly"><Mail size={17}/><input readOnly value={user.email}/><ShieldCheck size={16} className="profile-readonly-icon"/></div><small>To change this email, open the Email address section.</small></label>
        <div className="profile-form-footer"><span>Changes apply to your IRIS account.</span><button className="profile-primary-btn" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="profile-spin"/> : <Save size={16}/>} {busy ? 'Saving…' : 'Save changes'}</button></div></form></>}
      {section === 'email' && <><div className="profile-content-heading"><div className="profile-content-icon"><Mail size={19}/></div><div><h2>Change email address</h2><p>Verify your new email before it becomes your sign-in address.</p></div></div><div className="profile-info-banner"><ShieldCheck size={18}/><span>For your security, we’ll send a one-time verification code to the new email address.</span></div><form className="profile-form" onSubmit={emailOtpSent ? verifyEmail : sendEmailOtp}>
        <label className="profile-field"><span>Current email</span><div className="profile-input-wrap is-readonly"><Mail size={17}/><input readOnly value={user.email}/></div></label><label className="profile-field"><span>New email address</span><div className="profile-input-wrap"><Mail size={17}/><input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} disabled={emailOtpSent} placeholder="you@example.com" autoComplete="email"/></div></label>
        {emailOtpSent && <label className="profile-field"><span>Verification code</span><div className="profile-input-wrap"><ShieldCheck size={17}/><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={emailOtp} onChange={e => setEmailOtp(e.target.value)} placeholder="Enter 6-digit code"/></div><small>Check the inbox for your new email address.</small></label>}
        <div className="profile-form-footer"><span>{emailOtpSent ? 'Code expires after a short time.' : 'Your email won’t change until it is verified.'}</span><button className="profile-primary-btn" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="profile-spin"/> : <ArrowUpRight size={16}/>} {busy ? 'Please wait…' : emailOtpSent ? 'Verify & update' : 'Send verification code'}</button></div>{emailOtpSent && <button type="button" className="profile-text-btn" onClick={() => { setEmailOtpSent(false); setEmailOtp(''); setNotice(''); setError('') }}>Use a different email address</button>}</form></>}
      {section === 'password' && <><div className="profile-content-heading"><div className="profile-content-icon"><KeyRound size={19}/></div><div><h2>Password & security</h2><p>Update your password with a verification code sent to your current email.</p></div></div><div className="profile-security-card"><div className="profile-security-icon"><Mail size={18}/></div><div><strong>Verification email</strong><span>{user.email}</span></div><span className="profile-lock"><ShieldCheck size={15}/> Secure</span></div>
        {!passwordOtpSent ? <div className="profile-password-start"><p>We’ll verify it’s you before allowing a password change.</p><button type="button" className="profile-primary-btn" disabled={busy} onClick={sendPasswordOtp}>{busy ? <LoaderCircle size={16} className="profile-spin"/> : <Mail size={16}/>} {busy ? 'Sending code…' : 'Send password-change code'}</button></div> : <form className="profile-form profile-password-form" onSubmit={changePassword}>
          <label className="profile-field"><span>Verification code</span><div className="profile-input-wrap"><ShieldCheck size={17}/><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={passwordOtp} onChange={e => setPasswordOtp(e.target.value)} placeholder="Enter 6-digit code"/></div></label><label className="profile-field"><span>New password</span><div className="profile-input-wrap"><KeyRound size={17}/><input type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters"/></div></label><label className="profile-field"><span>Confirm new password</span><div className="profile-input-wrap"><KeyRound size={17}/><input type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"/></div></label><div className="profile-form-footer"><span>Use a password you don’t use elsewhere.</span><button className="profile-primary-btn" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="profile-spin"/> : <ShieldCheck size={16}/>} {busy ? 'Updating…' : 'Update password'}</button></div></form>}</>}
      {notice && <div className="profile-alert is-success" role="status"><CheckCircle2 size={17}/><span>{notice}</span></div>}{error && <div className="profile-alert is-error" role="alert"><ShieldCheck size={17}/><span>{error}</span></div>}
    </section></div><footer className="profile-footer"><span>IRIS <i>·</i> Intelligent Retrieval & Insight System</span><span><ShieldCheck size={13}/> Your knowledge, protected</span></footer>
  </div></main>
}
