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
    LeaveEntitlementRead
)
from app.auth_deps import get_current_user
from app.logic.workdays import calculate_business_days
from app.google_api import create_calendar_event, refresh_google_token
from app.email import send_new_request_email, send_status_update_email

router = APIRouter(prefix="/leaves", tags=["leaves"])

@router.get("/me/entitlement", response_model=LeaveEntitlementRead)
def get_my_entitlement(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current year entitlement for the user. Calculates pro-rated accrual.
    """
    now = datetime.utcnow()
    current_year = now.year
    entitlement = db.scalar(
        select(LeaveEntitlement).where(
            LeaveEntitlement.user_id == current_user.id,
            LeaveEntitlement.year == current_year
        )
    )
    
    if not entitlement:
        # Create default entitlement
        entitlement = LeaveEntitlement(
            user_id=current_user.id,
            year=current_year,
            total_days=20.0,
            remaining_days=20.0
        )
        db.add(entitlement)
        db.commit()
        db.refresh(entitlement)
    
    # Calculate pro-rated accrual (Czech law style approximation)
    # Days elapsed in the year / Total days in year * total_days
    start_of_year = datetime(current_year, 1, 1)
    end_of_year = datetime(current_year, 12, 31)
    days_in_year = (end_of_year - start_of_year).days + 1
    days_elapsed = (now - start_of_year).days + 1
    
    accrued_days = round((days_elapsed / days_in_year) * entitlement.total_days, 1)
    
    # Wrap in a dict or hack the object to include accrued_days for Pydantic
    # Since we added it to the schema, we can just return the ORM object and it will be populated if we set it
    entitlement.accrued_days = accrued_days
    return entitlement

@router.get("/me/requests", response_model=List[LeaveRequestRead])
def get_my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of my leave requests.
    """
    requests = db.scalars(
        select(LeaveRequest)
        .where(LeaveRequest.user_id == current_user.id)
        .order_by(desc(LeaveRequest.created_at))
    ).all()
    return requests

@router.post("/request", response_model=LeaveRequestRead)
async def create_leave_request(
    request: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new leave request.
    Calculates business days automatically.
    """
    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    days_count = calculate_business_days(request.start_date, request.end_date)
    
    new_request = LeaveRequest(
        user_id=current_user.id,
        start_date=request.start_date,
        end_date=request.end_date,
        days_count=days_count,
        note=request.note,
        status=LeaveStatus.PENDING
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # EMAIL NOTIFICATION
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
                start_date=str(request.start_date),
                end_date=str(request.end_date),
                days=days_count
            )
    except Exception as e:
        print(f"Failed to send email: {e}")

    return new_request

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
        if leave_request.gcal_event_id:
            oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == requester.id))
            if oauth:
                try:
                    from app.google_api import google_calendar_service # Need to add delete to google_api
                    # For now just log, but I should ideally implement it
                    print(f"Should delete GCal event {leave_request.gcal_event_id}")
                except: pass
        
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
    
    # GOOGLE CALENDAR
    oauth = db.scalar(select(OAuthAccount).where(OAuthAccount.user_id == requester.id, OAuthAccount.provider == "google"))
    if oauth:
        try:
            token = await refresh_google_token(db, oauth)
            gcal_end = leave_request.end_date + timedelta(days=1)
            event_id = await create_calendar_event(
                access_token=token,
                summary=f"Dovolená: {requester.full_name or requester.email}",
                start_date=leave_request.start_date.isoformat(),
                end_date=gcal_end.isoformat()
            )
            leave_request.gcal_event_id = event_id
        except Exception as e:
            print(f"GCal error: {e}")

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
    update: LeaveEntitlementRead,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    current_year = datetime.utcnow().year
    entitlement = db.scalar(select(LeaveEntitlement).where(LeaveEntitlement.user_id == user_id, LeaveEntitlement.year == current_year))
    if not entitlement:
        entitlement = LeaveEntitlement(user_id=user_id, year=current_year, total_days=update.total_days, remaining_days=update.remaining_days)
        db.add(entitlement)
    else:
        entitlement.total_days = update.total_days
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
