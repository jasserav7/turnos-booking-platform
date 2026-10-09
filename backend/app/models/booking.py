from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.service import Service
    from app.models.user import User


class BookingStatus(enum.StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


# The no_overlapping_bookings exclusion constraint lives only in the migration.
class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_bookings_end_after_start"),
        Index("ix_bookings_provider_id_starts_at", "provider_id", "starts_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("services.id"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            native_enum=False,
            length=20,
            create_constraint=True,
            name="booking_status",
        ),
        default=BookingStatus.pending,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Lists load these with joinedload (see services/bookings.py) to avoid N+1 queries.
    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    provider: Mapped[User] = relationship(foreign_keys=[provider_id])
    service: Mapped[Service] = relationship()

    @property
    def customer_name(self) -> str:
        return self.customer.full_name

    @property
    def provider_name(self) -> str:
        return self.provider.full_name

    @property
    def service_name(self) -> str:
        return self.service.name
