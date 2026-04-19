# backend/src/api/routes/auth.py
from fastapi import APIRouter, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends

from src.core.security import create_access_token, verify_password
from src.api.schemas.schemas import LoginIn, TokenOut

router = APIRouter()

# TODO: Replace with real DB user lookup
DEMO_USERS = {
    "admin": {
        "hashed_password": "$2b$12$demo_hash_replace_with_real",  # placeholder
        "role": "admin",
    }
}


@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """
    Issue a JWT access token.
    Currently uses a hardcoded demo user — wire to the DB User model when ready.
    """
    user = DEMO_USERS.get(form.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    # TODO: verify_password(form.password, user["hashed_password"])
    token = create_access_token({"sub": form.username, "role": user["role"]})
    return TokenOut(access_token=token)
