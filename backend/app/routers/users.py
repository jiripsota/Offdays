from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.schemas import UserRead, UserUpdate, UserCreate
from app.auth_deps import get_db, require_admin, get_current_user

from app.billing.manager import SubscriptionManager

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """
    Pre-provision a user. Only admins can do this.
    The user must belong to the same domain as the admin.
    """
    admin_domain = admin.email.split("@")[-1]
    user_domain = payload.email.split("@")[-1]
    
    if admin_domain != user_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can only invite users from your own domain ({admin_domain})",
        )
    
    # Check if user already exists
    existing_user = db.query(models.User).filter_by(email=payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )
    
    # Check limit before creating user
    sub_manager = SubscriptionManager(db)
    tenant = db.query(models.Tenant).filter_by(domain=admin_domain).first()
    if not tenant or not sub_manager.check_usage_limits(tenant.id, adding_users=1):
         raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Organization user limit reached. Please upgrade your plan.",
        )

    # Create user. last_login will be None.
    from uuid import uuid4
    new_user = models.User(
        id=uuid4(),
        email=payload.email,
        full_name=payload.full_name,
        is_admin=payload.is_admin,
        is_active=payload.is_active,
        user_type=payload.user_type
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    

    
    return new_user


# --- Users for sharing (allowed for any authenticated user) ---


@router.get("/all", response_model=list[UserRead])
def list_users_for_sharing(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns a list of all active users.
    Used by the password sharing dialog.
    Available to any authenticated user.
    """
    # Filter users to only show those from the same domain as the current user
    current_domain = current_user.email.split("@")[-1]
    
    users = (
        db.query(models.User)
        .filter(
            models.User.is_active.is_(True),
            models.User.email.like(f"%@{current_domain}")
        )
        .order_by(models.User.full_name.asc())
        .all()
    )
    return users


# --- Admin-only user management ---


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    # Admin sees only users in their domain
    admin_domain = admin.email.split("@")[-1]
    
    users = (
        db.query(models.User)
        .filter(models.User.email.like(f"%@{admin_domain}"))
        .all()
    )
    return users


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # IDOR Check: Ensure user belongs to admin's tenant/domain
    admin_domain = admin.email.split("@")[-1]
    user_domain = user.email.split("@")[-1]
    
    if admin_domain != user_domain:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # Obfuscate existence
            detail="User not found",
        )

    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # IDOR Check: Ensure user belongs to admin's tenant/domain
    admin_domain = admin.email.split("@")[-1]
    user_domain = user.email.split("@")[-1]
    
    if admin_domain != user_domain:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from removing their own admin rights or deactivating themselves
    if user.id == admin.id:
        if payload.is_admin is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own admin rights",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account",
            )

    # Capture previous state for audit purposes
    prev_full_name = user.full_name
    prev_is_admin = user.is_admin
    prev_is_active = user.is_active

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    
    if payload.is_active is not None:
        # If activating a user, check limits
        if payload.is_active is True and user.is_active is False:
             sub_manager = SubscriptionManager(db)
             tenant = db.query(models.Tenant).filter_by(domain=admin_domain).first()
             if not tenant or not sub_manager.check_usage_limits(tenant.id, adding_users=1):
                  raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Organization user limit reached. Please upgrade your plan.",
                )
        user.is_active = payload.is_active

    if payload.supervisor_id is not None:
        # Validate supervisor exists
        supervisor = db.get(models.User, payload.supervisor_id)
        if not supervisor:
             raise HTTPException(status_code=400, detail="Supervisor not found")
        # Prevent circular or self supervision?
        if supervisor.id == user.id:
            raise HTTPException(status_code=400, detail="User cannot be their own supervisor")
        user.supervisor_id = payload.supervisor_id

    if payload.user_type is not None:
        user.user_type = payload.user_type

    db.commit()
    db.refresh(user)

    # Get tenant from user's domain (validated above)
    tenant = db.query(models.Tenant).filter_by(domain=admin_domain).first()
    
    # Audit: user updated (especially admin/active flags)


    db.commit()
    return user
