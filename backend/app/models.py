from datetime import datetime
from app.database import db

class Job(db.Model):
    __tablename__ = "jobs"

    id = db.Column(db.String(36), primary_key=True)  # UUID
    action = db.Column(db.String(20), nullable=False) # 'INSTALL' or 'UNINSTALL'
    domain = db.Column(db.String(255), nullable=True)
    app_name = db.Column(db.String(255), nullable=True)
    uninstall_key = db.Column(db.Text, nullable=True)
    installer_path = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="PENDING") # PENDING, RUNNING, CANCELLED, COMPLETED, FAILED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    host_statuses = db.relationship("HostStatus", backref="job", cascade="all, delete-orphan")


class HostStatus(db.Model):
    __tablename__ = "host_statuses"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    job_id = db.Column(db.String(36), db.ForeignKey("jobs.id"), nullable=False)
    hostname = db.Column(db.String(255), nullable=False)
    fqdn = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default="PENDING") # PENDING, SCANNING, IN_PROGRESS, SUCCESS, FAILED, MISMATCH, CANCELLED
    progress_percent = db.Column(db.Integer, default=0)
    app_version = db.Column(db.String(100), nullable=True)
    log_output = db.Column(db.Text, default="")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
