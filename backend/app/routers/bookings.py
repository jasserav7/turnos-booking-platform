import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Query, status

from app.core.deps import CurrentUser, DbSession, require_roles
from app.models import Booking, BookingStatus, User, UserRole
from app.schemas.booking import BookingCancelIn, BookingIn, BookingListOut, BookingOut
from app.services import bookings

router = APIRouter(prefix="/bookings", tags=["bookings"])

CustomerUser = Annotated[User, Depends(require_roles(UserRole.customer))]
StaffUser = Annotated[User, Depends(require_roles(UserRole.provider, UserRole.admin))]


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    data: BookingIn, actor: CustomerUser, db: DbSession, tasks: BackgroundTasks
) -> Booking:
    return bookings.create_booking(db, actor, data, tasks)


@router.get("", response_model=BookingListOut)
def list_bookings(
    actor: CurrentUser,
    db: DbSession,
    status_filter: Annotated[BookingStatus | None, Query(alias="status")] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> BookingListOut:
    items, total = bookings.list_bookings(
        db, actor, status_filter, date_from, date_to, limit, offset
    )
    return BookingListOut(items=[BookingOut.model_validate(b) for b in items], total=total)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: uuid.UUID, actor: CurrentUser, db: DbSession) -> Booking:
    return bookings.get_booking(db, actor, booking_id)


@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: uuid.UUID, actor: StaffUser, db: DbSession, tasks: BackgroundTasks
) -> Booking:
    return bookings.confirm_booking(db, actor, booking_id, tasks)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: uuid.UUID,
    actor: CurrentUser,
    db: DbSession,
    tasks: BackgroundTasks,
    data: Annotated[BookingCancelIn | None, Body()] = None,
) -> Booking:
    return bookings.cancel_booking(db, actor, booking_id, data.reason if data else None, tasks)


@router.post("/{booking_id}/complete", response_model=BookingOut)
def complete_booking(booking_id: uuid.UUID, actor: StaffUser, db: DbSession) -> Booking:
    return bookings.complete_booking(db, actor, booking_id)
