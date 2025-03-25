from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import hashlib
import secrets

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    phone_number = Column(String(20), nullable=False)
    address = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    items = relationship("Item", back_populates="owner")
    trade_requests = relationship("TradeRequest", back_populates="user")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    is_available = Column(Boolean, default=True)

    # Relationships
    owner = relationship("User", back_populates="items")
    trade_requests = relationship("TradeRequest", back_populates="item")


class EquivalenceTable(Base):
    __tablename__ = "equivalence_table"

    id = Column(Integer, primary_key=True)
    item1 = Column(String(100), nullable=False)
    item2 = Column(String(100), nullable=False)
    equivalence_percentage = Column(Float, nullable=False)


class TradeRequest(Base):
    __tablename__ = "trade_requests"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    requested_quantity = Column(Float, nullable=False)
    status = Column(
        String(20), default="PENDING"
    )  # PENDING, MATCHED, COMPLETED, CANCELLED
    hash_key = Column(String(32), unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="trade_requests")
    item = relationship("Item", back_populates="trade_requests")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    trade_request_id = Column(Integer, ForeignKey("trade_requests.id"), nullable=False)
    initiator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_sent = Column(String(100), nullable=False)
    item_received = Column(String(100), nullable=False)
    transaction_cost = Column(Float, nullable=False)
    status = Column(String(20), default="PENDING")
    hash_key = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


def generate_secure_hash():
    """Generate a secure 16-digit hash for trade transactions."""
    return secrets.token_hex(8)  # 16-character hex string
