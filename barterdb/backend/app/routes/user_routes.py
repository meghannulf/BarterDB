import bcrypt
import re
from typing import Dict, Optional
from sqlalchemy.orm import Session
from .models import User


class AuthenticationService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def validate_email(self, email: str) -> bool:
        """
        Validate email format.

        Args:
            email (str): Email to validate

        Returns:
            bool: True if email is valid, False otherwise
        """
        email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return re.match(email_regex, email) is not None

    def validate_password(self, password: str) -> bool:
        """
        Validate password strength.

        Args:
            password (str): Password to validate

        Returns:
            bool: True if password meets criteria, False otherwise
        """
        # Minimum 8 characters, at least one uppercase, one lowercase, one number
        return (
            len(password) >= 8
            and any(c.isupper() for c in password)
            and any(c.islower() for c in password)
            and any(c.isdigit() for c in password)
        )

    def hash_password(self, password: str) -> str:
        """
        Hash a password using bcrypt.

        Args:
            password (str): Plain text password

        Returns:
            str: Hashed password
        """
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.

        Args:
            plain_password (str): Plain text password
            hashed_password (str): Hashed password to compare against

        Returns:
            bool: True if password matches, False otherwise
        """
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )

    def register_user(self, user_data: Dict) -> Optional[User]:
        """
        Register a new user.

        Args:
            user_data (Dict): User registration details

        Returns:
            User object if registration successful, None otherwise
        """
        # Validate input
        if not self.validate_email(user_data["email"]):
            raise ValueError("Invalid email format")

        if not self.validate_password(user_data["password"]):
            raise ValueError("Password does not meet strength requirements")

        # Check if email already exists
        existing_user = self.db.query(User).filter_by(email=user_data["email"]).first()
        if existing_user:
            raise ValueError("Email already registered")

        # Create new user
        new_user = User(
            name=user_data["name"],
            email=user_data["email"],
            phone_number=user_data["phone_number"],
            address=user_data["address"],
            password_hash=self.hash_password(user_data["password"]),
            is_verified=False,
            is_active=True,
        )

        try:
            self.db.add(new_user)
            self.db.commit()
            return new_user
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Registration failed: {str(e)}")

    def login(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate user login.

        Args:
            email (str): User email
            password (str): User password

        Returns:
            User object if login successful, None otherwise
        """
        user = self.db.query(User).filter_by(email=email, is_active=True).first()

        if user and self.verify_password(password, user.password_hash):
            return user

        return None
