import time
from celery import group
from app.celery_app import celery_app
from app.database import db
from app.models import Job, HostStatus
from app.services.winrm_service import WinRMService
from app.services.registry_service import RegistryService
from flask import Flask
from app.config import Config

def get_flask_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app


@celery_app.task(bind=True, name="app.tasks.process_single_host")
def process_single_host(self, host_status_id, action, credentials, installer_path=None, app_name=None, uninstall_key=None):
    """
    Sub-task running concurrently for each target host.
    Executes PyWinRM operations and updates real-time status in SQLite.
    """
    app = get_flask_app()
    with app.app_context():
        host_status = HostStatus.query.get(host_status_id)
        if not host_status:
            return {"status": "ERROR", "message": "HostStatus ID not found"}

        target_host = host_status.fqdn
        username = credentials.get("username")
        password = credentials.get("password")

        try:
            # 1. Update status to IN_PROGRESS
            host_status.status = "IN_PROGRESS"
            host_status.progress_percent = 25
            host_status.log_output = f"Connecting via WinRM to {target_host}..."
            db.session.commit()

            winrm_client = WinRMService(target_host, username, password)

            if action == "INSTALL":
                host_status.progress_percent = 50
                host_status.log_output = f"Executing installer: {installer_path}..."
                db.session.commit()

                # Remote silent installation command
                ps_script = f"""
                Start-Process -FilePath "cmd.exe" -ArgumentList "/c {installer_path}" -Wait -NoNewWindow
                """
                result = winrm_client.run_powershell(ps_script)

                if result["success"]:
                    host_status.status = "SUCCESS"
                    host_status.progress_percent = 100
                    host_status.log_output = "Installation completed successfully."
                else:
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Installation failed: {result['stderr']}"

            elif action == "UNINSTALL":
                host_status.progress_percent = 40
                host_status.log_output = f"Verifying registry installation for {app_name}..."
                db.session.commit()

                # Step 1: Verify application presence & version on target host
                discovery = RegistryService.fetch_installed_applications(target_host, username, password)
                
                if not discovery["success"]:
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Registry Query Failed: {discovery['error']}"
                    db.session.commit()
                    return {"status": "FAILED"}

                # Search matching app by display name
                matched_app = next((a for a in discovery["apps"] if a["name"] == app_name), None)

                if not matched_app:
                    host_status.status = "MISMATCH"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Report: Application '{app_name}' not found on host."
                    db.session.commit()
                    return {"status": "MISMATCH"}

                # Step 2: Execute uninstall using target's registry uninstall string
                host_status.progress_percent = 70
                host_status.app_version = matched_app["version"]
                host_status.log_output = f"Uninstalling version {matched_app['version']} using registry key..."
                db.session.commit()

                target_uninstall_cmd = matched_app.get("uninstall_string") or uninstall_key
                uninstall_res = RegistryService.execute_registry_uninstall(
                    target_host, username, password, target_uninstall_cmd
                )

                if uninstall_res["success"]:
                    host_status.status = "SUCCESS"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Successfully uninstalled {app_name} (v{matched_app['version']})."
                else:
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Uninstall failed: {uninstall_res['stderr']}"

            db.session.commit()
            return {"status": host_status.status, "host": target_host}

        except Exception as e:
            host_status.status = "FAILED"
            host_status.progress_percent = 100
            host_status.log_output = f"Unexpected Error: {str(e)}"
            db.session.commit()
            return {"status": "FAILED", "error": str(e)}


@celery_app.task(bind=True, name="app.tasks.execute_bulk_operation")
def execute_bulk_operation(self, job_id, credentials):
    """
    Master orchestrator: Fetches all target hosts under job_id and launches
    sub-tasks concurrently using a Celery task group.
    """
    app = get_flask_app()
    with app.app_context():
        job = Job.query.get(job_id)
        if not job:
            return {"status": "ERROR", "message": f"Job {job_id} not found"}

        job.status = "RUNNING"
        db.session.commit()

        hosts = HostStatus.query.filter_by(job_id=job_id).all()

        # Build parallel task signatures
        subtasks = [
            process_single_host.s(
                host_status_id=h.id,
                action=job.action,
                credentials=credentials,
                installer_path=job.installer_path,
                app_name=job.app_name,
                uninstall_key=job.uninstall_key
            )
            for h in hosts
        ]

        # Launch parallel subtasks group
        job_group = group(subtasks)
        group_result = job_group.apply_async()

        # Wait for all parallel workers to wrap up
        group_result.get()

        # Update Master Job status
        job.status = "COMPLETED"
        db.session.commit()

        return {"status": "COMPLETED", "job_id": job_id}
