from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, desc

from app.auth_deps import get_db
from app.models import User, LeaveRequest, LeaveEntitlement, LeaveStatus, OAuthAccount
from app.schemas import (
    LeaveRequestCreate, 
    LeaveRequestRead, 
    LeaveEntitlementRead,
    LeaveEntitlementUpdate
)
from app.auth_deps import get_current_user
from app.logic.workdays import calculate_business_days
from app.google_api import create_calendar_event, refresh_google_token
from app.email import send_new_request_email, send_status_update_email

router = APIRouter(prefix="/leaves", tags=["leaves"])

@router.get("/me/entitlement", response_model=LeaveEntitlementRead)
def get_my_entitlement(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get entitlement for specific year (or current if not specified).
    """
    now = datetime.utcnow()
    target_year = year if year else now.year
    
    entitlement = db.scalar(
        select(LeaveEntitlement).where(
            LeaveEntitlement.user_id == current_user.id,
            LeaveEntitlement.year == target_year
        )
    )
    
    if not entitlement:
        # Create default entitlement for that year
        # Fetch tenant settings to get default_vacation_days
        from app.models import Tenant
        domain = current_user.email.split("@")[-1]
        tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
        if not tenant:
            tenant = db.scalar(select(Tenant))
        
        total_default = float(tenant.default_vacation_days) if tenant else 20.0
        
        # We need to import func from sqlalchemy
        from sqlalchemy import func
        used_days = db.scalar(
            select(func.sum(LeaveRequest.days_count))
            .where(
                LeaveRequest.user_id == current_user.id,
                LeaveRequest.status == LeaveStatus.APPROVED,
                func.extract('year', LeaveRequest.start_date) == target_year
            )
        ) or 0.0

        entitlement = LeaveEntitlement(
            user_id=current_user.id,
            year=target_year,
            total_days=total_default,
            remaining_days=total_default - used_days
        )
        db.add(entitlement)
        db.commit()
        db.refresh(entitlement)
    
    # Calculate pro-rated accrual
    if target_year > now.year:
        # Future year: 0 accrued so far
        accrued_days = 0.0
    elif target_year < now.year:
        # Past year: all accrued
        accrued_days = entitlement.total_days
    else:
        # Current year
        start_of_year = datetime(target_year, 1, 1)
        end_of_year = datetime(target_year, 12, 31)
        days_in_year = (end_of_year - start_of_year).days + 1
        days_elapsed = (now - start_of_year).days + 1
        accrued_days = round((days_elapsed / days_in_year) * entitlement.total_days, 1)
    
    entitlement.accrued_days = accrued_days
    return entitlement

@router.get("/me/requests", response_model=List[LeaveRequestRead])
def get_my_requests(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of my leave requests.
    """
    query = select(LeaveRequest).where(LeaveRequest.user_id == current_user.id)
    
    if year:
        # Filter by year (using start_date year)
        start_of_year = datetime(year, 1, 1).date()
        end_of_year = datetime(year, 12, 31).date()
        query = query.where(LeaveRequest.start_date >= start_of_year, LeaveRequest.start_date <= end_of_year)
        
    requests = db.scalars(query.order_by(desc(LeaveRequest.created_at))).all()
    return requests

from datetime import date

async def _create_request_internal(
    db: Session, 
    current_user: User, 
    start_date: date, 
    end_date: date, 
    note: str, 
    start_half_day: bool = False,
    end_half_day: bool = False,
    send_email: bool = True
) -> LeaveRequest:
    from app.logic.workdays import is_weekend, is_holiday

    # 0. SMART TRIM DATES
    # Advance start_date if weekend/holiday
    while start_date <= end_date and (is_weekend(start_date) or is_holiday(start_date)):
        start_date += timedelta(days=1)
        
    # Regress end_date if weekend/holiday
    while end_date >= start_date and (is_weekend(end_date) or is_holiday(end_date)):
        end_date -= timedelta(days=1)
        
    if start_date > end_date:
        # This happens if the entire range was weekends/holidays
        raise HTTPException(status_code=400, detail="No business days to request in this specific range.")

    # 1. FIND OVERLAPS
    overlaps = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.user_id == current_user.id,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
            LeaveRequest.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.CANCEL_PENDING])
        )
    ).all()

    # 2. RESOLVE OVERLAPS
    approved_dates = set()
    
    for ol in overlaps:
        if ol.status in [LeaveStatus.PENDING, LeaveStatus.CANCEL_PENDING]:
            # Delete pending overlap
            db.delete(ol)
        elif ol.status == LeaveStatus.APPROVED:
            ov_start = max(ol.start_date, start_date)
            ov_end = min(ol.end_date, end_date)
            
            curr = ov_start
            while curr <= ov_end:
                 approved_dates.add(curr)
                 curr += timedelta(days=1)

    # 3. CALCULATE NET DAYS
    days_count = 0.0
    from app.logic.workdays import is_weekend, is_holiday
    
    curr = start_date
    while curr <= end_date:
        if curr not in approved_dates:
            if not is_weekend(curr) and not is_holiday(curr):
                days_count += 1.0
        curr += timedelta(days=1)
    
    # Half-day Logic
    if start_half_day:
        # Only subtract if it was counted as a full day (business day & not approved)
        if start_date not in approved_dates and not is_weekend(start_date) and not is_holiday(start_date):
            days_count -= 0.5

    if start_date != end_date and end_half_day:
        if end_date not in approved_dates and not is_weekend(end_date) and not is_holiday(end_date):
            days_count -= 0.5
        
    if days_count <= 0:
        raise HTTPException(status_code=400, detail="No new business days to request in this specific range.")
    
    new_request = LeaveRequest(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        start_half_day=start_half_day,
        end_half_day=end_half_day,
        days_count=days_count,
        note=note,
        status=LeaveStatus.PENDING
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # EMAIL NOTIFICATION
    if send_email:
        try:
            recipient_email = None
            if current_user.supervisor_id:
                supervisor = db.get(User, current_user.supervisor_id)
                if supervisor:
                    recipient_email = supervisor.email
            
            if not recipient_email:
                admin = db.scalar(select(User).where(User.is_admin == True).limit(1))
                if admin:
                    recipient_email = admin.email

            if recipient_email:
                await send_new_request_email(
                    to_email=recipient_email,
                    requester_name=current_user.full_name or current_user.email,
                    start_date=str(start_date),
                    end_date=str(end_date),
                    days=days_count
                )
        except Exception as e:
            print(f"Failed to send email: {e}")

    return new_request

@router.post("/request", response_model=LeaveRequestRead)
async def create_leave_request(
    request: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new leave request.
    Automatically splits requests across year boundaries.
    """
    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Check for Year Split
    if request.start_date.year != request.end_date.year:
        # Range 1: Start -> Dec 31
        dec31 = date(request.start_date.year, 12, 31)
        
        req1 = None
        try:
            # First part: keeps start_half_day, but end_half_day is False (unless logic requires it, but year end is not end of request)
            req1 = await _create_request_internal(
                db, current_user, request.start_date, dec31, request.note, 
                start_half_day=request.start_half_day, 
                end_half_day=False
            )
        except HTTPException:
            pass 

        # Range 2: Jan 1 -> End
        jan1 = date(request.end_date.year, 1, 1)
        req2 = None
        try:
            # Second part: start_half_day False, keeps end_half_day
            req2 = await _create_request_internal(
                db, current_user, jan1, request.end_date, request.note,
                start_half_day=False,
                end_half_day=request.end_half_day
            )
        except HTTPException:
            pass

        if not req1 and not req2:
            raise HTTPException(status_code=400, detail="No business days found in the selected range.")

        # Return the first successful one for schema compliance, user will see both in dashboard
        return req1 if req1 else req2
    else:
        return await _create_request_internal(
            db, current_user, request.start_date, request.end_date, request.note,
            start_half_day=request.start_half_day,
            end_half_day=request.end_half_day
        )

@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_pending_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a pending request (delete it).
    """
    leave_request = db.scalar(select(LeaveRequest).where(LeaveRequest.id == request_id))
    if not leave_request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if leave_request.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if leave_request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only delete pending requests")
        
    db.delete(leave_request)
    db.commit()
    return None

@router.post("/{request_id}/request-cancel", response_model=LeaveRequestRead)
async def request_cancellation(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Request cancellation of an approved request.
    """
    leave_request = db.scalar(select(LeaveRequest).where(LeaveRequest.id == request_id))
    if not leave_request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if leave_request.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if leave_request.status != LeaveStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Can only request cancellation for approved requests")
        
    leave_request.status = LeaveStatus.CANCEL_PENDING
    db.commit()
    db.refresh(leave_request)
    
    # Notify supervisor
    try:
        recipient_email = None
        if current_user.supervisor_id:
            supervisor = db.get(User, current_user.supervisor_id)
            if supervisor:
                recipient_email = supervisor.email
        
        if recipient_email:
             # Repurposing send_new_request_email for cancel request or similar
             await send_new_request_email(
                to_email=recipient_email,
                requester_name=f"{current_user.full_name or current_user.email} (CANCEL REQUEST)",
                start_date=str(leave_request.start_date),
                end_date=str(leave_request.end_date),
                days=leave_request.days_count
            )
    except Exception as e:
        print(f"Failed to send email: {e}")

    return leave_request

@router.get("/approvals", response_model=List[LeaveRequestRead])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get requests waiting for my approval.
    """
    query = select(LeaveRequest).where(
        (LeaveRequest.status == LeaveStatus.PENDING) | 
        (LeaveRequest.status == LeaveStatus.CANCEL_PENDING)
    )
    
    if not current_user.is_admin:
        subordinates = select(User.id).where(User.supervisor_id == current_user.id)
        query = query.where(LeaveRequest.user_id.in_(subordinates))
        
    requests = db.scalars(query.options(joinedload(LeaveRequest.user)).order_by(desc(LeaveRequest.created_at))).all()
    return requests

@router.post("/{request_id}/approve", response_model=LeaveRequestRead)
async def approve_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approve a request or a cancellation request.
    """
    leave_request = db.scalar(select(LeaveRequest).where(LeaveRequest.id == request_id))
    if not leave_request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    requester = db.get(User, leave_request.user_id)
    if not current_user.is_admin and requester.supervisor_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")

    # Handle Cancellation Approval
    if leave_request.status == LeaveStatus.CANCEL_PENDING:
        leave_request.status = LeaveStatus.CANCELLED
        
        # Restore entitlement
        entitlement = db.scalar(
            select(LeaveEntitlement).where(
                LeaveEntitlement.user_id == leave_request.user_id,
                LeaveEntitlement.year == leave_request.start_date.year
            )
        )
        if entitlement:
            entitlement.remaining_days += leave_request.days_count
            db.add(entitlement)
            
        # Delete GCal event if exists
        try:
            oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == requester.id, OAuthAccount.provider == "google"))
            admin_oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == current_user.id, OAuthAccount.provider == "google"))
            
            # Personal
            if leave_request.gcal_event_id and oauth:
                token = await refresh_google_token(db, oauth)
                await delete_calendar_event(token, leave_request.gcal_event_id)
            
            # Shared
            if leave_request.shared_gcal_event_id:
                # Get shared calendar ID
                from app.models import Tenant
                domain = requester.email.split("@")[-1]
                tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
                if not tenant: tenant = db.scalar(select(Tenant))
                
                if tenant and tenant.shared_calendar_id:
                    try:
                        from app.google_api import get_service_account_token
                        sa_token = get_service_account_token(["https://www.googleapis.com/auth/calendar"])
                        await delete_calendar_event(sa_token, leave_request.shared_gcal_event_id, calendar_id=tenant.shared_calendar_id)
                    except Exception as e:
                        print(f"Shared GCal delete error (SA): {e}")
        except Exception as e:
            print(f"Failed to delete GCal events: {e}")
            
        db.commit()
        db.refresh(leave_request)
        return leave_request

    # Handle Normal Approval
    leave_request.status = LeaveStatus.APPROVED
    
    # DEDUCT Entitlement
    entitlement = db.scalar(
        select(LeaveEntitlement).where(
            LeaveEntitlement.user_id == leave_request.user_id,
            LeaveEntitlement.year == leave_request.start_date.year
        )
    )
    if entitlement:
        entitlement.remaining_days -= leave_request.days_count
        db.add(entitlement)
    else:
        # Create entitlement if it doesn't exist so we track the deduction
        entitlement = LeaveEntitlement(
            user_id=leave_request.user_id,
            year=leave_request.start_date.year,
            total_days=20.0,
            remaining_days=20.0 - leave_request.days_count
        )
        db.add(entitlement)
    
    # GOOGLE CALENDAR SYNC
    oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == requester.id, OAuthAccount.provider == "google"))
    
    # Get shared calendar ID from tenant
    from app.models import Tenant
    domain = requester.email.split("@")[-1]
    tenant = db.scalar(select(Tenant).where(Tenant.domain == domain))
    if not tenant:
        tenant = db.scalar(select(Tenant))
    shared_cal_id = tenant.shared_calendar_id if tenant else None
    
    # Get current user (admin/manager) token for shared calendar sync if needed
    admin_oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == current_user.id, OAuthAccount.provider == "google"))

    if oauth:
        try:
            token = await refresh_google_token(db, oauth)
            gcal_end = (leave_request.end_date + timedelta(days=1)).isoformat()
            
            # 1. Sync to Personal Calendar
            summary = f"{requester.full_name or requester.email} ({leave_request.days_count})"
            event_id = await create_calendar_event(
                access_token=token,
                summary=summary,
                start_date=leave_request.start_date.isoformat(),
                end_date=gcal_end
            )
            leave_request.gcal_event_id = event_id
        except Exception as e:
            print(f"Personal GCal error: {e}")

    # 2. Sync to Shared Calendar (using Service Account)
    if shared_cal_id:
        try:
            from app.google_api import get_service_account_token
            sa_token = get_service_account_token(["https://www.googleapis.com/auth/calendar"])
            gcal_end = (leave_request.end_date + timedelta(days=1)).isoformat()
            
            summary = f"{requester.full_name or requester.email} ({leave_request.days_count})"
            shared_event_id = await create_calendar_event(
                access_token=sa_token,
                summary=summary,
                start_date=leave_request.start_date.isoformat(),
                end_date=gcal_end,
                calendar_id=shared_cal_id
            )
            leave_request.shared_gcal_event_id = shared_event_id
        except Exception as e:
            print(f"Shared GCal error (SA): {e}")

    db.commit()
    db.refresh(leave_request)

    # EMAIL
    try:
        await send_status_update_email(
            to_email=requester.email,
            status="approved",
            start_date=str(leave_request.start_date),
            end_date=str(leave_request.end_date)
        )
    except: pass

    return leave_request

@router.post("/{request_id}/reject", response_model=LeaveRequestRead)
async def reject_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    leave_request = db.scalar(select(LeaveRequest).where(LeaveRequest.id == request_id))
    if not leave_request:
        raise HTTPException(status_code=404, detail="Request not found")

    requester = db.get(User, leave_request.user_id)
    if not current_user.is_admin and requester.supervisor_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")

    if leave_request.status == LeaveStatus.CANCEL_PENDING:
        # Rejecting cancellation means keeping it APPROVED
        leave_request.status = LeaveStatus.APPROVED
    else:
        leave_request.status = LeaveStatus.REJECTED
        
    db.commit()
    db.refresh(leave_request)

    # EMAIL
    try:
        await send_status_update_email(
            to_email=requester.email,
            status="rejected" if leave_request.status == LeaveStatus.REJECTED else "cancellation_rejected",
            start_date=str(leave_request.start_date),
            end_date=str(leave_request.end_date)
        )
    except: pass

    return leave_request

@router.put("/admin/{user_id}/entitlement", response_model=LeaveEntitlementRead)
def update_user_entitlement(
    user_id: UUID,
    update: LeaveEntitlementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    current_year = datetime.utcnow().year
    entitlement = db.scalar(select(LeaveEntitlement).where(LeaveEntitlement.user_id == user_id, LeaveEntitlement.year == current_year))
    if not entitlement:
        entitlement = LeaveEntitlement(
            user_id=user_id, 
            year=current_year, 
            total_days=update.total_days if update.total_days is not None else 20.0, 
            remaining_days=update.remaining_days if update.remaining_days is not None else 20.0
        )
        db.add(entitlement)
    else:
        if update.total_days is not None:
            entitlement.total_days = update.total_days
        if update.remaining_days is not None:
            entitlement.remaining_days = update.remaining_days
    db.commit()
    db.refresh(entitlement)
    return entitlement

@router.get("/admin/{user_id}/entitlement", response_model=LeaveEntitlementRead)
def get_user_entitlement(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    current_year = datetime.utcnow().year
    entitlement = db.scalar(select(LeaveEntitlement).where(LeaveEntitlement.user_id == user_id, LeaveEntitlement.year == current_year))
    if not entitlement:
         return LeaveEntitlementRead(id=0, user_id=user_id, year=current_year, total_days=20.0, remaining_days=20.0)
    return entitlement
@router.get("/calendar", response_model=List[LeaveRequestRead])
def get_team_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all approved leave requests for the team/tenant.
    """
    domain = current_user.email.split("@")[-1]
    
    query = (
        select(LeaveRequest)
        .join(User)
        .where(
            User.email.like(f"%@{domain}"),
            LeaveRequest.status.in_([LeaveStatus.APPROVED, LeaveStatus.CANCEL_PENDING])
        )
        .options(joinedload(LeaveRequest.user))
    )
    
    requests = db.scalars(query).all()
    return requests
