import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
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
    execute_bulk_operation.delay(job_id, credentials)

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
                "hostname": h.hostname,
                "fqdn": h.fqdn,
                "status": h.status,
                "progress_percent": h.progress_percent,
                "log_output": h.log_output
            }
            for h in hosts
        ]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
