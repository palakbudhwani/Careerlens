"""
Authentication routes

POST /api/auth/register          → create account + seed candidate profile
POST /api/auth/login             → return JWT
GET  /api/auth/me                → current user info
POST /api/auth/logout            → client-side logout
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db

from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    create_password_reset_token,
    decode_password_reset_token,
)

from models.user import User, Candidate

from schemas.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserOut,
    MessageResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Register
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
):
    # Check duplicate email
    existing_user = (
        db.query(User)
        .filter(User.email == body.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Create user
    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )

    db.add(user)

    # Get user.id before commit
    db.flush()

    # Auto-create empty candidate profile
    name_parts = body.full_name.strip().split()

    initials = "".join(
        part[0].upper()
        for part in name_parts[:2]
    )

    candidate = Candidate(
        user_id=user.id,
        name=body.full_name,
        initials=initials,
        career_readiness=0.0,
        profile_strength=0.0,
        job_compatibility=0.0,
        readiness_delta=0.0,
        preferred_roles=[],
        skills=[],
        experience=[],
        education=[],
    )

    db.add(candidate)

    db.commit()
    db.refresh(user)

    # Create JWT
    token = create_access_token(
        {
            "sub": str(user.id)
        }
    )

    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == body.email)
        .first()
    )

    # Invalid credentials
    if not user or not verify_password(
        body.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    # Check active account
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    # Create JWT
    token = create_access_token(
        {
            "sub": str(user.id)
        }
    )

    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Current User
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=UserOut,
)
def me(
    current_user: User = Depends(get_current_user),
):
    return UserOut.model_validate(current_user)


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    response_model=MessageResponse,
)
def logout(
    current_user: User = Depends(get_current_user),
):
    return MessageResponse(
        message="Logged out successfully."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Forgot Password
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
)
def forgot_password(
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == body.email)
        .first()
    )

    # Don't reveal whether an email exists.
    if not user:
        return MessageResponse(
            message=(
                "If an account exists with this email, "
                "a password reset link has been generated."
            )
        )

    # Generate reset token
    reset_token = create_password_reset_token(user.id)

    # DEVELOPMENT ONLY
    #
    # Later this token will be sent through email.
    # For now we print it in the backend terminal.
    print("\n")
    print("=" * 60)
    print("PASSWORD RESET TOKEN")
    print("=" * 60)
    print(reset_token)
    print("=" * 60)
    print("\n")

    return MessageResponse(
        message=(
            "Password reset token generated. "
            "Check the backend terminal."
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# Reset Password
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/reset-password",
    response_model=MessageResponse,
)
def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    # Decode and validate reset token
    user_id = decode_password_reset_token(
        body.token
    )

    # Find user
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Hash new password
    user.hashed_password = hash_password(
        body.new_password
    )

    db.commit()

    return MessageResponse(
        message=(
            "Password has been reset successfully. "
            "You can now log in."
        )
    )