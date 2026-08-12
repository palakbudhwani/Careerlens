from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from passlib.context import CryptContext

from fastapi import (
    Depends,
    HTTPException,
    status,
)

from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db


# ─────────────────────────────────────────────────────────────────────────────
# Password Hashing
# ─────────────────────────────────────────────────────────────────────────────

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


# ─────────────────────────────────────────────────────────────────────────────
# OAuth2
# ─────────────────────────────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


# ─────────────────────────────────────────────────────────────────────────────
# Password Functions
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(
    plain: str,
    hashed: str,
) -> bool:
    return pwd_context.verify(
        plain,
        hashed,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Access JWT
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:

    payload = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload["exp"] = expire

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Decode Access JWT
# ─────────────────────────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:

    try:

        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Password Reset JWT
# ─────────────────────────────────────────────────────────────────────────────

def create_password_reset_token(
    user_id: int,
) -> str:

    payload = {
        "sub": str(user_id),
        "type": "password_reset",
        "exp": (
            datetime.now(timezone.utc)
            + timedelta(minutes=30)
        ),
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Decode Password Reset Token
# ─────────────────────────────────────────────────────────────────────────────

def decode_password_reset_token(
    token: str,
) -> int:

    try:

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        # Make sure this is a password reset token
        if payload.get("type") != "password_reset":

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token.",
            )

        user_id = payload.get("sub")

        if user_id is None:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token.",
            )

        return int(user_id)

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    except ValueError:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Current User Dependency
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):

    from models.user import User

    payload = decode_token(token)

    user_id: str = payload.get("sub")

    if user_id is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:

        user_id_int = int(user_id)

    except ValueError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id_int)
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user