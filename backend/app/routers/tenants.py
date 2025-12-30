from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.auth_deps import get_db, get_current_user
from app.models import User, Tenant
from app.schemas import TenantRead, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("/me", response_model=TenantRead)
def get_my_tenant(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current tenant settings. (For now assuming single tenant or domain matched).
    The app currently uses a simple domain-based tenant lookup or default.
    Since we don't have complex tenant resolution yet, we'll fetch the first tenant record
    or the one matching the current user's email domain if applicable.
    """
    domain = current_user.email.split("@")[-1]
    tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
    
    if not tenant:
        # Fallback to first available tenant if domain doesn't match
        tenant = db.scalar(select(Tenant))
        
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant settings not found")
        
    # Read service account email from key file
    import json
    import os
    from app.config import settings
    service_account_email = None
    if os.path.exists(settings.google_service_account_file):
        try:
            with open(settings.google_service_account_file, "r") as f:
                key_data = json.load(f)
                service_account_email = key_data.get("client_email")
        except: pass
    
    tenant_data = TenantRead.from_orm(tenant)
    tenant_data.service_account_email = service_account_email
    return tenant_data

@router.patch("/me", response_model=TenantRead)
def update_my_tenant(
    update: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update tenant settings. Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    domain = current_user.email.split("@")[-1]
    tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
    
    if not tenant:
        tenant = db.scalar(select(Tenant))
        
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant settings not found")
        
    if update.shared_calendar_id is not None:
        tenant.shared_calendar_id = update.shared_calendar_id
    if update.default_vacation_days is not None and update.default_vacation_days != tenant.default_vacation_days:
        old_val = tenant.default_vacation_days
        new_val = update.default_vacation_days
        tenant.default_vacation_days = new_val
        
        # Propagate to ALL entitlements for THIS tenant for CURRENT year
        from datetime import datetime
        from app.models import LeaveEntitlement
        current_year = datetime.utcnow().year
        
        # Select users by domain
        users_query = select(User).where(User.email.like(f"%@{tenant.domain}"))
        users = db.scalars(users_query).all()
        user_ids = [u.id for u in users]
        
        if user_ids:
            entitlements_query = select(LeaveEntitlement).where(
                LeaveEntitlement.user_id.in_(user_ids),
                LeaveEntitlement.year == current_year
            )
            entitlements = db.scalars(entitlements_query).all()
            
            diff = float(new_val - old_val)
            for ent in entitlements:
                ent.total_days += diff
                ent.remaining_days += diff
                db.add(ent)
        
    db.commit()
    db.refresh(tenant)
    
    # Read service account email from key file
    import json
    import os
    from app.config import settings
    service_account_email = None
    if os.path.exists(settings.google_service_account_file):
        try:
            with open(settings.google_service_account_file, "r") as f:
                key_data = json.load(f)
                service_account_email = key_data.get("client_email")
        except: pass
    
    tenant_data = TenantRead.from_orm(tenant)
    tenant_data.service_account_email = service_account_email
    return tenant_data

@router.post("/me/sync")
async def sync_all_to_shared_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Force sync all approved leave requests to the shared calendar.
    Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    domain = current_user.email.split("@")[-1]
    tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
    if not tenant: tenant = db.scalar(select(Tenant))
    
    if not tenant or not tenant.shared_calendar_id:
        raise HTTPException(status_code=400, detail="Shared calendar not configured")

    from app.models import LeaveRequest, LeaveStatus
    from app.google_api import get_service_account_token, create_calendar_event
    from datetime import timedelta

    # Get ALL requests to ensure we can also cleanup ones that shouldn't be in the shared calendar
    all_requests = db.scalars(select(LeaveRequest)).all()
    
    sync_count = 0
    cleanup_count = 0
    errors = 0
    first_error = None
    
    try:
        sa_token = get_service_account_token(["https://www.googleapis.com/auth/calendar"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service account token: {e}")

    from app.google_api import delete_calendar_event

    for req in all_requests:
        # Case 1: Approved but missing from shared calendar -> CREATE
        if req.status == LeaveStatus.APPROVED:
            if not req.shared_gcal_event_id:
                try:
                    requester = db.get(User, req.user_id)
                    gcal_end = (req.end_date + timedelta(days=1)).isoformat()
                    summary = f"{requester.full_name or requester.email} ({req.days_count})"
                    
                    shared_event_id = await create_calendar_event(
                        access_token=sa_token,
                        summary=summary,
                        start_date=req.start_date.isoformat(),
                        end_date=gcal_end,
                        calendar_id=tenant.shared_calendar_id
                    )
                    req.shared_gcal_event_id = shared_event_id
                    db.add(req)
                    sync_count += 1
                except Exception as e:
                    catch_err = str(e)
                    print(f"Error creating sync for request {req.id}: {catch_err}")
                    if not first_error: first_error = catch_err
                    errors += 1
        
        # Case 2: Not approved but has a shared calendar event ID -> DELETE (Orphan cleanup)
        else:
            if req.shared_gcal_event_id:
                try:
                    await delete_calendar_event(
                        sa_token, 
                        req.shared_gcal_event_id, 
                        calendar_id=tenant.shared_calendar_id
                    )
                    req.shared_gcal_event_id = None
                    db.add(req)
                    cleanup_count += 1
                except Exception as e:
                    print(f"Error cleaning up sync for request {req.id}: {e}")
                    # We don't block on cleanup errors (e.g. if event already manually deleted)

    db.commit()
    return {
        "synchronized": sync_count,
        "cleaned": cleanup_count,
        "errors": errors,
        "message": first_error if errors > 0 else None
    }
