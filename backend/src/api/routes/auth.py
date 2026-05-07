# backend/src/api/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from src.db.session import get_db
from src.db.models.models import (
    User, Farm, Device, Actuator, IrrigationEvent, IrrigationCommand, 
    Recommendation, SensorReading, Alert, Prediction, DeviceCommand, IrrigationStatus
)
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
        "role": user.role.value if hasattr(user.role, "value") else str(user.role or "farmer")
    })

    # Get the user's first farm if exists
    from src.db.models.models import Farm
    farm_result = await db.execute(
        select(Farm.id).where(Farm.user_id == user.id).limit(1)
    )
    farm_id = farm_result.scalar_one_or_none()

    return TokenOut(
        access_token=token,
        farm_id=farm_id,
        username=user.username
    )


@router.post("/check-exists")
async def check_user_exists(body: dict, db: AsyncSession = Depends(get_db)):
    username = body.get("username", "")
    email = body.get("email", "")
    
    # Check username
    res_user = await db.execute(select(User).where(User.username == username))
    username_taken = res_user.scalar_one_or_none() is not None
    
    # Check email
    res_email = await db.execute(
        select(User).where(func.lower(User.email) == email.lower().strip())
    )
    email_taken = res_email.scalar_one_or_none() is not None
    
    return {"username_taken": username_taken, "email_taken": email_taken}



@router.post("/reset-password")
async def reset_password(body: dict, db: AsyncSession = Depends(get_db)):
    email = body.get("email", "")
    new_password = body.get("new_password", "")
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and new_password are required")
    
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower().strip())
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


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
        select(User).where(func.lower(User.email) == body.email.lower().strip())
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

    print(f"[DEBUG] Updating user {user.id} with body: {body.model_dump(exclude_unset=True)}")

    try:
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

        if body.password:
            user.password_hash = hash_password(body.password)
            print("[DEBUG] Password updated in database model")

        await db.commit()
        await db.refresh(user)
        return user
    except Exception as e:
        print(f"[ERROR] Update me failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/me")
async def delete_me(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user)
):
    user_id = int(token_data["sub"])
    
    # 1. Get farm IDs
    farm_res = await db.execute(select(Farm).where(Farm.user_id == user_id))
    farms = farm_res.scalars().all()
    farm_ids = [f.id for f in farms]

    if farm_ids:
        for f_id in farm_ids:
            # Get device IDs for this farm
            dev_res = await db.execute(select(Device.device_id).where(Device.farm_id == f_id))
            device_ids = dev_res.scalars().all()

            if device_ids:
                # Sensor Readings & Commands
                await db.execute(delete(SensorReading).where(SensorReading.device_id.in_(device_ids)))
                await db.execute(delete(DeviceCommand).where(DeviceCommand.device_id.in_(device_ids)))
                
                # Actuators
                act_res = await db.execute(select(Actuator.id).where(Actuator.device_id.in_(device_ids)))
                actuator_ids = act_res.scalars().all()
                
                if actuator_ids:
                    await db.execute(delete(IrrigationEvent).where(IrrigationEvent.actuator_id.in_(actuator_ids)))
                    await db.execute(delete(IrrigationCommand).where(IrrigationCommand.actuator_id.in_(actuator_ids)))
                    await db.execute(delete(Actuator).where(Actuator.id.in_(actuator_ids)))

                await db.execute(delete(Device).where(Device.farm_id == f_id))
            
            # Farm-level data
            await db.execute(delete(Recommendation).where(Recommendation.farm_id == f_id))
            await db.execute(delete(Alert).where(Alert.farm_id == f_id))
            await db.execute(delete(Prediction).where(Prediction.farm_id == f_id))
        
        # Delete Farms
        await db.execute(delete(Farm).where(Farm.user_id == user_id))

    # Finally delete User
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    
    return {"status": "ok", "message": "User and all associated data deleted"}


@router.post("/forgot-password")
async def forgot_password(
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower().strip())
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="EMAIL_NOT_FOUND")
        
    # Here we would normally generate OTP and send via email.
    # For now, we will return success so the frontend can proceed with its EmailJS logic if needed,
    # but at least we've verified the user exists in DB.
    return {"status": "ok", "message": "User found"}

