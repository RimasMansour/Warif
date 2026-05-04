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
        full_name=body.full_name,
        full_name_en=body.full_name_en,
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

    if body.username and body.username != user.username:
        taken = await db.execute(
            select(User).where(User.username == body.username)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )
        user.username = body.username

    if body.email and body.email != user.email:
        taken = await db.execute(
            select(User).where(User.email == body.email)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        user.email = body.email

    if body.full_name:
        user.full_name = body.full_name
    
    if body.full_name_en:
        user.full_name_en = body.full_name_en

    if body.language:
        user.language = body.language

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/forgot-password")
async def forgot_password(
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="EMAIL_NOT_FOUND")
        
    # Here we would normally generate OTP and send via email.
    # For now, we will return success so the frontend can proceed with its EmailJS logic if needed,
    # but at least we've verified the user exists in DB.
    return {"status": "ok", "message": "User found"}


@router.post("/reset-password")
async def reset_password(
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    email = body.get("email")
    new_password = body.get("new_password")
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and new password are required")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"status": "ok", "message": "Password updated successfully"}
