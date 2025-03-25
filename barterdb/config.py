import os
from datetime import timedelta


class Config:
    # SQLAlchemy Database Configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://barterdb_user:barterdb_password@localhost/barterdb_database",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Flask Configuration
    SECRET_KEY = os.environ.get(
        "SECRET_KEY", "your-very-secret-key-change-in-production"
    )

    # JWT Configuration
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)

    # Security Settings
    DEBUG = False
    CORS_ENABLED = True

    # Transaction Settings
    BASE_TRANSACTION_FEE = 0.05  # 5% base transaction fee
    MAX_TRADE_QUANTITY_PERCENTAGE = 0.8  # Max 80% of item quantity can be traded

    # Logging Configuration
    LOGGING_LEVEL = os.environ.get("LOGGING_LEVEL", "INFO")
    LOG_FILE_PATH = os.path.join(os.path.dirname(__file__), "logs", "barterdb.log")

    # Admin Configuration
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@barterdb.com")


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///development.db"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///testing.db"


class ProductionConfig(Config):
    # Production-specific configurations
    pass


def get_config():
    env = os.environ.get("FLASK_ENV", "development")
    config_selector = {
        "development": DevelopmentConfig,
        "testing": TestingConfig,
        "production": ProductionConfig,
    }
    return config_selector.get(env, DevelopmentConfig)
