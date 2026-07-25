from celery import Celery
from app.config import Config

def make_celery():
    celery = Celery(
        "app",
        broker=Config.CELERY_BROKER_URL,
        backend=Config.CELERY_RESULT_BACKEND,
	include=["app.tasks"]  # Explicitly imports tasks module
    )
    celery.conf.update(
        task_track_started=True,
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True
    )
    return celery

celery_app = make_celery()
