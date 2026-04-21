# backend/src/api/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models.models import User
from src.core.security import (
    create_access_token,
    verify_password,
    hash_password,
    get_current_user,
)
from src.api.schemas.schemas import (
    LoginIn, TokenOut,
    UserRegisterIn, UserOut, UserUpdateIn
)

router = APIRouter()


@router.post("/login", response_model=TokenOut)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(User.username == form.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value
    })
    return TokenOut(access_token=token)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegisterIn,
    db: AsyncSession = Depends(get_db)
):
    # Check username taken
    result = await db.execute(
        select(User).where(User.username == body.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Check email taken
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        language=body.language or "ar",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user)
):
    result = await db.execute(
        select(User).where(User.id == int(token_data["sub"]))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserOut)
async def update_me(
    body: UserUpdateIn,
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user)
):
    result = await db.execute(
        select(User).where(User.id == int(token_data["sub"]))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.username:
        user.username = body.username
    if body.email:
        user.email = body.email
    if body.language:
        user.language = body.language

    await db.commit()
    await db.refresh(user)
    return user
