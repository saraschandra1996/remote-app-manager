import uuid
from app.celery_app import celery_app
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask import send_from_directory
from app.config import Config
from app.database import db, init_db
from app.models import Job, HostStatus
from app.tasks import execute_bulk_operation
from app.services.registry_service import RegistryService

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={r"/*": {"origins": "*"}})
init_db(app)

# ---------------------------------------------------------------------------
# Health Check Endpoint
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "service": "Flask Remote App Manager API"})


# ---------------------------------------------------------------------------
# Registry Discovery Endpoint (Sample 1 Host)
# ---------------------------------------------------------------------------
@app.route("/apps/discover", methods=["POST"])
@app.route("/api/apps/discover", methods=["POST"])
def discover_apps():
    try:
        data = request.json or {}
        sample_host = data.get("sample_host", "").strip()
        domain = data.get("domain", "").strip()
        username = data.get("username")
        password = data.get("password")

        if not sample_host or not username or not password:
            return jsonify({"error": "sample_host, username, and password are required"}), 400

        fqdn = f"{sample_host}.{domain}" if domain and not sample_host.endswith(domain) else sample_host

        result = RegistryService.fetch_installed_applications(fqdn, username, password)
        if not result.get("success"):
            return jsonify({"error": result.get("error", "Failed to query remote registry.")}), 500

        return jsonify({"host": fqdn, "applications": result.get("apps", [])})

    except Exception as e:
        return jsonify({"error": f"Backend Server Exception: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Job Creation Endpoint
# ---------------------------------------------------------------------------
@app.route("/jobs", methods=["POST"])
@app.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.json or {}
    hostnames = data.get("hostnames", [])
    domain = data.get("domain", "").strip()
    action = data.get("action", "INSTALL").upper()
    username = data.get("username")
    password = data.get("password")
    app_name = data.get("app_name")
    uninstall_key = data.get("uninstall_key")
    installer_path = data.get("installerPath") or data.get("installer_path")

    if not hostnames or not username or not password:
        return jsonify({"error": "Hostnames, username, and password are required"}), 400

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        action=action,
        domain=domain,
        app_name=app_name,
        uninstall_key=uninstall_key,
        installer_path=installer_path,
        status="PENDING"
    )
    db.session.add(job)

    for host in hostnames:
        clean_host = host.strip()
        if not clean_host:
            continue
            
        fqdn = f"{clean_host}.{domain}" if domain and not clean_host.endswith(domain) else clean_host
        host_status = HostStatus(
            job_id=job_id,
            hostname=clean_host,
            fqdn=fqdn,
            status="PENDING"
        )
        db.session.add(host_status)

    db.session.commit()

    credentials = {"username": username, "password": password}
    server_host = request.host  # Get the server IP automatically

    # Update this line to pass the server_host
    execute_bulk_operation.delay(job_id, credentials, server_host)

    return jsonify({"job_id": job_id, "status": "QUEUED"}), 201


# ---------------------------------------------------------------------------
# Get Job Status Endpoint
# ---------------------------------------------------------------------------
@app.route("/jobs/<job_id>", methods=["GET"])
@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id):
    job = Job.query.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    hosts = HostStatus.query.filter_by(job_id=job_id).all()
    return jsonify({
        "job_id": job.id,
        "action": job.action,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "hosts": [
            {
		"id": h.id,
                "hostname": h.hostname,
                "fqdn": h.fqdn,
                "status": h.status,
                "progress_percent": h.progress_percent,
                "log_output": h.log_output
            }
            for h in hosts
        ]
    })

# ---------------------------------------------------------------------------
# Individual Host Cancellation Endpoint
# ---------------------------------------------------------------------------
@app.route("/jobs/<job_id>/hosts/<int:host_id>/cancel", methods=["POST"])
@app.route("/api/jobs/<job_id>/hosts/<int:host_id>/cancel", methods=["POST"])
def cancel_single_host(job_id, host_id):
    host = HostStatus.query.get(host_id)
    if not host or host.job_id != job_id:
        return jsonify({"error": "Host task not found"}), 404

    if host.status in ["COMPLETED", "FAILED", "CANCELLED", "SUCCESS", "MISMATCH"]:
        return jsonify({"message": f"Host task is already {host.status}"}), 400

    # 1. Update the database status
    host.status = "CANCELLED"
    host.log_output += "\n\n[System] Execution forcefully cancelled by user."
    db.session.commit()

    # 2. Hunt down and terminate only this specific Celery task
    try:
        inspector = celery_app.control.inspect()
        active_tasks = inspector.active() or {}
        reserved_tasks = inspector.reserved() or {}
        
        task_to_revoke = None
        
        def find_host_task(task_dict):
            for worker_name, tasks in task_dict.items():
                for task in tasks:
                    if task.get("name") == "app.tasks.process_single_host":
                        kwargs = task.get("kwargs", {})
                        args = task.get("args", [])
                        h_id = kwargs.get("host_status_id") if "host_status_id" in kwargs else (args[0] if len(args) > 0 else None)
                        if h_id == host_id:
                            return task["id"]
            return None

        task_to_revoke = find_host_task(active_tasks) or find_host_task(reserved_tasks)
        
        if task_to_revoke:
            celery_app.control.revoke(task_to_revoke, terminate=True, signal="SIGTERM")
            
    except Exception as e:
        print(f"Warning: Failed to contact Celery workers for revocation: {str(e)}")

    return jsonify({"message": "Host task cancelled successfully", "host_id": host_id}), 200

import os
from werkzeug.utils import secure_filename

# Add this near your other configuration variables
UPLOAD_FOLDER = '/app/uploads'
ALLOWED_EXTENSIONS = {'exe', 'msi'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------------------------------------------------------------------
# File Upload Endpoint
# ---------------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
@app.route("/api/upload", methods=["POST"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        
        try:
            file.save(save_path)
            return jsonify({
                "message": "File uploaded successfully", 
                "filename": filename,
                "path": save_path
            }), 201
        except Exception as e:
            return jsonify({"error": f"Failed to save file: {str(e)}"}), 500
            
    return jsonify({"error": "Invalid file type. Only .exe and .msi are allowed."}), 400

# ---------------------------------------------------------------------------
# List Uploaded Files Endpoint (For React Dropdown)
# ---------------------------------------------------------------------------
@app.route("/uploads", methods=["GET"])
@app.route("/api/uploads", methods=["GET"])
def list_uploads():
    try:
        files = []
        for filename in os.listdir(UPLOAD_FOLDER):
            if allowed_file(filename):
                files.append({
                    "filename": filename,
                    "path": os.path.join(UPLOAD_FOLDER, filename)
                })
        return jsonify({"files": files}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to list files: {str(e)}"}), 500

@app.route("/uploads/download/<filename>", methods=["GET"])
@app.route("/api/uploads/download/<filename>", methods=["GET"])
def download_file(filename):
    """Allows remote Windows hosts to download the installer."""
    return send_from_directory(UPLOAD_FOLDER, filename)

# ---------------------------------------------------------------------------
# Task Cancellation Endpoint
# ---------------------------------------------------------------------------
@app.route("/jobs/<job_id>/cancel", methods=["POST"])
@app.route("/api/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job(job_id):
    job = Job.query.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    if job.status in ["COMPLETED", "FAILED", "CANCELLED"]:
        return jsonify({"message": f"Job is already {job.status}"}), 400

    # 1. Update the database statuses to CANCELLED
    job.status = "CANCELLED"
    
    hosts = HostStatus.query.filter_by(job_id=job_id).all()
    host_status_ids = []
    
    for h in hosts:
        if h.status in ["PENDING", "IN_PROGRESS", "SCANNING"]:
            h.status = "CANCELLED"
            h.log_output += "\n\n[System] Execution forcefully cancelled by user."
        host_status_ids.append(h.id)
        
    db.session.commit()

    # 2. Hunt down and terminate the active Celery tasks
    try:
        inspector = celery_app.control.inspect()
        active_tasks = inspector.active() or {}
        reserved_tasks = inspector.reserved() or {}
        
        tasks_to_revoke = []
        
        # Helper function to find matching tasks across all workers
        def find_target_tasks(task_dict):
            for worker_name, tasks in task_dict.items():
                for task in tasks:
                    task_name = task.get("name")
                    kwargs = task.get("kwargs", {})
                    args = task.get("args", [])
                    
                    # Check if it's the parent bulk operation task
                    if task_name == "app.tasks.execute_bulk_operation":
                        if job_id in args or kwargs.get("job_id") == job_id:
                            tasks_to_revoke.append(task["id"])
                            
                    # Check if it's a child single host task
                    elif task_name == "app.tasks.process_single_host":
                        # The ID might be passed as a kwarg or the first arg
                        h_id = kwargs.get("host_status_id") if "host_status_id" in kwargs else (args[0] if len(args) > 0 else None)
                        if h_id in host_status_ids:
                            tasks_to_revoke.append(task["id"])

        # Scan both running and queued tasks
        find_target_tasks(active_tasks)
        find_target_tasks(reserved_tasks)
        
        # 3. Fire the termination signal
        for task_id in tasks_to_revoke:
            celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
            
    except Exception as e:
        print(f"Warning: Failed to contact Celery workers for revocation: {str(e)}")

    return jsonify({"message": "Job cancelled successfully", "job_id": job_id}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
