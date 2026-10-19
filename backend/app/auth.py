
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import re
import secrets
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, EmailOTP, UserSession

router = APIRouter(prefix="/auth", tags=["Authentication"])

OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60
SESSION_COOKIE_NAME = "iris_session"
SESSION_TTL_DAYS = 7


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    # Password hashing using Python's built-in scrypt.
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=32,
    )
    return f"{salt.hex()}${derived.hex()}"


def verify_password_hash(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, expected_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def hash_otp(otp: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{otp}".encode("utf-8")).hexdigest()


def send_otp_email(email: str, otp: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Your IRIS signup verification code"
    message["From"] = settings.smtp_email
    message["To"] = email
    message.set_content(
        f"Your IRIS signup verification code is: {otp}\n\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n"
        "If you did not request this code, you can ignore this email."
    )

    with smtplib.SMTP(
        settings.smtp_host,
        settings.smtp_port,
        timeout=20,
    ) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.smtp_email, settings.smtp_app_password)
        server.send_message(message)


class SignupOTPRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=40)
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class SignupOTPVerify(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    otp: str = Field(pattern=r"^\d{6}$")


@router.post("/signup/request-otp")
def request_signup_otp(
    payload: SignupOTPRequest,
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    user = db.query(User).filter(User.email == email).first()

    if user and user.is_email_verified:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    latest_otp = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.email == email,
            EmailOTP.purpose == "signup",
            EmailOTP.consumed_at.is_(None),
        )
        .order_by(EmailOTP.created_at.desc())
        .first()
    )

    if latest_otp:
        created_at = latest_otp.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        seconds_since = (utc_now() - created_at).total_seconds()
        if seconds_since < OTP_RESEND_SECONDS:
            wait = max(1, OTP_RESEND_SECONDS - int(seconds_since))
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait} seconds before requesting another OTP.",
            )

        db.delete(latest_otp)

    otp = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_hex(16)

    otp_record = EmailOTP(
        email=email,
        purpose="signup",
        code_hash=f"{salt}${hash_otp(otp, salt)}",
        expires_at=utc_now() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        attempts=0,
    )

    # Store the user as inactive until email verification succeeds.
    # An unverified account cannot log in.
    if user is None:
        user = User(
            name=payload.name.strip(),
            phone=payload.phone.strip(),
            email=email,
            password_hash=hash_password(payload.password),
            is_email_verified=False,
            is_active=False,
        )
        db.add(user)
    else:
        user.name = payload.name.strip()
        user.phone = payload.phone.strip()
        user.password_hash = hash_password(payload.password)
        user.is_active = False

    db.add(otp_record)

    try:
        db.commit()
        send_otp_email(email, otp)
    except Exception:
        db.rollback()
        # Do not expose SMTP credentials or internal server errors.
        raise HTTPException(
            status_code=503,
            detail="Unable to send the verification email. Please try again later.",
        )

    return {
        "message": "If the request is valid, a signup verification email has been sent.",
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


@router.post("/signup/verify-otp")
def verify_signup_otp(
    payload: SignupOTPVerify,
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)

    otp_record = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.email == email,
            EmailOTP.purpose == "signup",
            EmailOTP.consumed_at.is_(None),
        )
        .order_by(EmailOTP.created_at.desc())
        .first()
    )

    if otp_record is None:
        raise HTTPException(
            status_code=400,
            detail="OTP is invalid, expired, or already used.",
        )

    expires_at = otp_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if utc_now() >= expires_at:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="OTP has expired. Request a new one.",
        )

    if otp_record.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Request a new OTP.",
        )

    try:
        salt, stored_hash = otp_record.code_hash.split("$", 1)
    except ValueError:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP. Request a new one.")

    if not hmac.compare_digest(hash_otp(payload.otp, salt), stored_hash):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect OTP.")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Signup request not found.")

    user.is_email_verified = True
    user.is_active = True
    otp_record.consumed_at = utc_now()
    db.commit()

    return {
        "message": "Email verified successfully. Your account is active.",
        "email": user.email,
    }


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1, max_length=128)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please log in.")

    session = db.query(UserSession).filter(
        UserSession.token_hash == token_digest(token),
        UserSession.revoked_at.is_(None),
    ).first()
    if session is None:
        raise HTTPException(status_code=401, detail="Session is invalid. Please log in again.")

    expiry = session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if utc_now() >= expiry:
        session.revoked_at = utc_now()
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    user = db.get(User, session.user_id)
    if user is None or not user.is_active or not user.is_email_verified:
        raise HTTPException(status_code=401, detail="Account is not active.")
    return user


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email).first()

    # Same response for unknown email and incorrect password.
    if user is None or not verify_password_hash(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_email_verified or not user.is_active:
        raise HTTPException(status_code=403, detail="Verify your email before logging in.")

    raw_token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=SESSION_TTL_DAYS)
    db.add(UserSession(user_id=user.id, token_hash=token_digest(raw_token), expires_at=expires_at))
    db.commit()

    # Local development uses HTTP. Set secure=True before deploying behind HTTPS.
    response.set_cookie(
        key=SESSION_COOKIE_NAME, value=raw_token, httponly=True, secure=False,
        samesite="lax", max_age=SESSION_TTL_DAYS * 24 * 60 * 60, path="/",
    )
    return {"message": "Login successful.", "user": {"id": user.id, "name": user.name, "phone": user.phone, "email": user.email}}


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "phone": user.phone, "email": user.email}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        session = db.query(UserSession).filter(UserSession.token_hash == token_digest(token), UserSession.revoked_at.is_(None)).first()
        if session is not None:
            session.revoked_at = utc_now()
            db.commit()
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/", httponly=True, samesite="lax")
    return {"message": "Logged out successfully."}

class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=40)

class EmailChangeRequest(BaseModel):
    new_email: str = Field(min_length=5, max_length=320)

class EmailChangeVerifyRequest(BaseModel):
    new_email: str = Field(min_length=5, max_length=320)
    otp: str = Field(pattern=r"^\d{6}$")

class PasswordChangeVerifyRequest(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

def send_security_otp_email(email: str, otp: str, purpose_label: str) -> None:
    message = EmailMessage()
    message["Subject"] = f"Your IRIS {purpose_label} verification code"
    message["From"] = settings.smtp_email
    message["To"] = email
    message.set_content(
        f"Your IRIS verification code is: {otp}\n\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.\n"
        "If you did not request this code, you can ignore this email."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.smtp_email, settings.smtp_app_password)
        server.send_message(message)

def create_security_otp(db: Session, user: User, purpose: str, recipient: str) -> None:
    latest = (db.query(EmailOTP).filter(EmailOTP.email == recipient, EmailOTP.purpose == purpose, EmailOTP.consumed_at.is_(None)).order_by(EmailOTP.created_at.desc()).first())
    if latest:
        created = latest.created_at
        if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
        seconds = (utc_now() - created).total_seconds()
        if seconds < OTP_RESEND_SECONDS:
            raise HTTPException(status_code=429, detail=f"Please wait {max(1, OTP_RESEND_SECONDS-int(seconds))} seconds before requesting another code.")
        db.delete(latest)
    otp = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_hex(16)
    db.add(EmailOTP(email=recipient, purpose=purpose, code_hash=f"{salt}${hash_otp(otp, salt)}", expires_at=utc_now()+timedelta(minutes=OTP_EXPIRY_MINUTES), attempts=0))
    try:
        db.commit()
        send_security_otp_email(recipient, otp, purpose.replace("_", " "))
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=503, detail="Unable to send verification email. Please try again later.")

def verify_security_otp(db: Session, email: str, purpose: str, otp: str) -> EmailOTP:
    record = (db.query(EmailOTP).filter(EmailOTP.email == email, EmailOTP.purpose == purpose, EmailOTP.consumed_at.is_(None)).order_by(EmailOTP.created_at.desc()).first())
    if record is None: raise HTTPException(status_code=400, detail="Code is invalid, expired, or already used.")
    expiry = record.expires_at
    if expiry.tzinfo is None: expiry = expiry.replace(tzinfo=timezone.utc)
    if utc_now() >= expiry:
        db.delete(record); db.commit()
        raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
    if record.attempts >= OTP_MAX_ATTEMPTS:
        db.delete(record); db.commit()
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new code.")
    try: salt, stored = record.code_hash.split("$", 1)
    except ValueError: raise HTTPException(status_code=400, detail="Invalid code. Request a new one.")
    if not hmac.compare_digest(hash_otp(otp, salt), stored):
        record.attempts += 1; db.commit()
        raise HTTPException(status_code=400, detail="Incorrect verification code.")
    return record

@router.patch("/profile")
def update_profile(payload: ProfileUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = payload.name.strip()
    phone = payload.phone.strip()
    if not name: raise HTTPException(status_code=422, detail="Name is required.")
    if not phone: raise HTTPException(status_code=422, detail="Phone number is required.")
    user.name = name
    user.phone = phone
    db.commit(); db.refresh(user)
    return {"id": user.id, "name": user.name, "phone": user.phone, "email": user.email}

@router.post("/email-change/request-otp")
def request_email_change(payload: EmailChangeRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_email = normalize_email(payload.new_email)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", new_email): raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if new_email == user.email.lower(): raise HTTPException(status_code=400, detail="This is already your current email.")
    existing = db.query(User).filter(User.email == new_email).first()
    if existing: raise HTTPException(status_code=409, detail="An account with this email already exists.")
    create_security_otp(db, user, "email_change", new_email)
    return {"message": "Verification code sent to the new email address."}

@router.post("/email-change/verify-otp")
def verify_email_change(payload: EmailChangeVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_email = normalize_email(payload.new_email)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", new_email): raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if db.query(User).filter(User.email == new_email, User.id != user.id).first(): raise HTTPException(status_code=409, detail="An account with this email already exists.")
    record = verify_security_otp(db, new_email, "email_change", payload.otp)
    user.email = new_email
    record.consumed_at = utc_now()
    db.commit(); db.refresh(user)
    return {"id": user.id, "name": user.name, "phone": user.phone, "email": user.email}

@router.post("/password-change/request-otp")
def request_password_change(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    create_security_otp(db, user, "password_change", user.email)
    return {"message": "Verification code sent to your current email address."}

@router.post("/password-change/verify-otp")
def verify_password_change(payload: PasswordChangeVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = verify_security_otp(db, user.email, "password_change", payload.otp)
    user.password_hash = hash_password(payload.new_password)
    record.consumed_at = utc_now()
    db.commit()
    return {"message": "Password updated successfully."}



class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)


class PasswordResetVerifyRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/password-reset/request-otp")
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    # Do not disclose whether an email is registered. Only active, verified accounts get an OTP.
    user = db.query(User).filter(
        User.email == email,
        User.is_active.is_(True),
        User.is_email_verified.is_(True),
    ).first()
    if user is not None:
        create_security_otp(db, user, "password_reset", email)

    return {"message": "If an eligible account exists, a password reset code has been sent."}


@router.post("/password-reset/verify-otp")
def verify_password_reset(payload: PasswordResetVerifyRequest, response: Response, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    user = db.query(User).filter(
        User.email == email,
        User.is_active.is_(True),
        User.is_email_verified.is_(True),
    ).first()
    # Same general error for an unknown account and an invalid reset code.
    if user is None:
        raise HTTPException(status_code=400, detail="The reset code is invalid, expired, or already used.")

    record = verify_security_otp(db, email, "password_reset", payload.otp)
    user.password_hash = hash_password(payload.new_password)
    record.consumed_at = utc_now()

    # Revoke all existing sessions after a successful password reset.
    db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.revoked_at.is_(None),
    ).update({UserSession.revoked_at: utc_now()}, synchronize_session=False)
    db.commit()

    # Also clear the browser session cookie, if present.
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/", httponly=True, samesite="lax")
    return {"message": "Password reset successfully. Please sign in with your new password."}
