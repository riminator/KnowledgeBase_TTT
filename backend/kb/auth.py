"""
auth.py — Supabase JWT validation for FastAPI.

Supabase issues standard RS256 JWTs signed with the project's JWT secret.
Every protected route declares `user_id: str = Depends(get_current_user)` to
automatically extract and validate the caller's identity.

The JWT secret is found in:
  Supabase dashboard → Project Settings → API → JWT Secret
Set it as SUPABASE_JWT_SECRET in your .env file.
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from kb.config import SUPABASE_JWT_SECRET

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    Validate the Supabase JWT in the Authorization header and return the user's
    UUID string (``sub`` claim), which is stable and unique per Supabase user.

    Raises HTTP 401 if the token is missing, expired, or has an invalid signature.
    """
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the server.",
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase JWTs have no audience claim
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no sub claim.")

    return user_id
