import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-default")
    
    # SQLite Database Configuration
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
    os.makedirs(DATA_DIR, exist_ok=True)
    
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{os.path.join(DATA_DIR, 'app.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Celery & Redis Configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
