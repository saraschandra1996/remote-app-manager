import os
import time
from celery import group, chord
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
def process_single_host(self, host_status_id, action, credentials, installer_path=None, app_name=None, uninstall_key=None, server_host=None):
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
            host_status.status = "IN_PROGRESS"
            host_status.progress_percent = 15
            host_status.log_output = f"Connecting via WinRM to {target_host}..."
            db.session.commit()

            winrm_client = WinRMService(target_host, username, password)

            if action == "INSTALL":
                host_status.progress_percent = 25
                host_status.log_output = "Taking pre-installation registry snapshot..."
                db.session.commit()
                
                pre_install_discovery = RegistryService.fetch_installed_applications(target_host, username, password)
                pre_installed_apps = {app["name"]: app["version"] for app in pre_install_discovery.get("apps", [])} if pre_install_discovery.get("success") else {}

                install_start_time = time.time() # START INSTALL TIMER

                if installer_path and installer_path.startswith("/app/uploads"):
                    filename = os.path.basename(installer_path)
                    download_url = f"http://{server_host}/api/uploads/download/{filename}"
                    remote_dest = f"C:\\Windows\\Temp\\{filename}"
                    
                    host_status.progress_percent = 40
                    host_status.log_output = f"Transferring {filename} to Traget machine {target_host}"
                    db.session.commit()

                    if filename.lower().endswith(".msi"):
                        ps_script = f"""
                        $ProgressPreference = 'SilentlyContinue'
                        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                        Invoke-WebRequest -Uri "{download_url}" -OutFile "{remote_dest}" -UseBasicParsing
                        
                        $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"{remote_dest}`" /qn /norestart" -PassThru -WindowStyle Hidden
                        try {{
                            if ($proc) {{ $proc | Wait-Process -Timeout 300 -ErrorAction Stop }}
                        }} catch {{
                            if ($proc) {{ $proc | Stop-Process -Force -ErrorAction SilentlyContinue }}
                        }} finally {{
                            Remove-Item -Path "{remote_dest}" -Force -ErrorAction SilentlyContinue
                        }}
                        """
                    else:
                        ps_script = f"""
                        $ProgressPreference = 'SilentlyContinue'
                        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                        Invoke-WebRequest -Uri "{download_url}" -OutFile "{remote_dest}" -UseBasicParsing
                        
                        $proc = Start-Process -FilePath "{remote_dest}" -ArgumentList "/S /VERYSILENT /quiet /norestart" -PassThru -WindowStyle Hidden
                        try {{
                            if ($proc) {{ $proc | Wait-Process -Timeout 300 -ErrorAction Stop }}
                            Start-Sleep -Seconds 30
                        }} catch {{
                            if ($proc) {{ $proc | Stop-Process -Force -ErrorAction SilentlyContinue }}
                        }} finally {{
                            Remove-Item -Path "{remote_dest}" -Force -ErrorAction SilentlyContinue
                        }}
                        """
                else:
                    host_status.progress_percent = 50
                    host_status.log_output = f"Executing UNC path installer: {installer_path}..."
                    db.session.commit()
                    
                    ps_script = f"""
                    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList '/c `"{installer_path}`"' -PassThru -WindowStyle Hidden
                    try {{
                        if ($proc) {{ $proc | Wait-Process -Timeout 300 -ErrorAction Stop }}
                        Start-Sleep -Seconds 30
                    }} catch {{
                        if ($proc) {{ $proc | Stop-Process -Force -ErrorAction SilentlyContinue }}
                    }}
                    """

                result = winrm_client.run_powershell(ps_script)

                if result["success"]:
                    host_status.progress_percent = 80
                    host_status.log_output = "Installation command succeeded. Verifying registry for new application..."
                    db.session.commit()
                    
                    installed_verified = False
                    new_app_name, new_app_version = None, None
                    
                    for _ in range(6): 
                        post_install_discovery = RegistryService.fetch_installed_applications(target_host, username, password)
                        post_installed_apps = {app["name"]: app["version"] for app in post_install_discovery.get("apps", [])} if post_install_discovery.get("success") else {}
                        
                        new_apps = [name for name in post_installed_apps.keys() if name not in pre_installed_apps]
                        if new_apps:
                            installed_verified = True
                            new_app_name = new_apps[0]
                            new_app_version = post_installed_apps[new_app_name]
                            break
                        time.sleep(5)
                    
                    install_elapsed = time.time() - install_start_time # END INSTALL TIMER
                    
                    host_status.status = "SUCCESS"
                    host_status.progress_percent = 100
                    
                    if installed_verified:
                        host_status.log_output = f"Verified Successfully: Installed '{new_app_name}' (v{new_app_version}) in {install_elapsed:.1f}s."
                    else:
                        host_status.log_output = f"Installation completed successfully (Exit Code 0) in {install_elapsed:.1f}s, but no explicit new registry entry was detected."
                else:
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Installation failed: {result['stderr']}"

            elif action == "UNINSTALL":
                host_status.progress_percent = 40
                host_status.log_output = f"Verifying registry installation for {app_name}..."
                db.session.commit()

                discovery = RegistryService.fetch_installed_applications(target_host, username, password)
                
                if not discovery.get("success"):
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Registry Query Failed: {discovery.get('error', 'Unknown error')}"
                    db.session.commit()
                    return {"status": "FAILED"}

                matched_app = next((a for a in discovery.get("apps", []) if a["name"] == app_name), None)

                if not matched_app:
                    host_status.status = "MISMATCH"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Report: Application '{app_name}' not found on host."
                    db.session.commit()
                    return {"status": "MISMATCH"}

                host_status.progress_percent = 60
                host_status.app_version = matched_app["version"]
                host_status.log_output = f"Attempting uninstallation for {app_name} using registry string"
                db.session.commit()

                target_uninstall_cmd = matched_app.get("uninstall_string") or uninstall_key
                safe_cmd = (target_uninstall_cmd or "").replace("'", "''")
                
                # --- OPTIMIZED: Timeout dropped from 120s to 60s ---
                ps_script = f"""
                $rawCmd = '{safe_cmd}'
                $exePath = $rawCmd
                $arguments = ""

                if ($rawCmd -match '^"([^"]+)"\s*(.*)') {{
                    $exePath = $Matches[1]
                    $arguments = $Matches[2]
                }} elseif ($rawCmd -match '^([^\s]+\.exe)\s*(.*)') {{
                    $exePath = $Matches[1]
                    $arguments = $Matches[2]
                }}

                if ($exePath -match '(?i)\.exe$') {{
                    $arguments = "/S /VERYSILENT /quiet /norestart"
                    
                    if (Test-Path $exePath) {{
                        $appDir = Split-Path $exePath -Parent
                        $arguments += " _?=$appDir"
                    }}
                    
                    try {{
                        $proc = Start-Process -FilePath $exePath -ArgumentList $arguments -PassThru -WindowStyle Hidden -ErrorAction Stop
                        if ($proc) {{ $proc | Wait-Process -Timeout 60 -ErrorAction SilentlyContinue }}
                    }} catch {{ }}
                    
                }} elseif ($exePath -match '(?i)msiexec') {{
                    $arguments = $arguments -replace '(?i)/[ix]', '/X'
                    if ($arguments -notmatch '(?i)/qn') {{
                        $arguments += " /qn /norestart"
                    }}
                    
                    try {{
                        $proc = Start-Process -FilePath $exePath -ArgumentList $arguments -PassThru -WindowStyle Hidden -ErrorAction Stop
                        if ($proc) {{ $proc | Wait-Process -Timeout 60 -ErrorAction SilentlyContinue }}
                    }} catch {{ }}
                    
                }} else {{
                    try {{
                        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$rawCmd`"" -PassThru -WindowStyle Hidden -ErrorAction Stop
                        if ($proc) {{ $proc | Wait-Process -Timeout 60 -ErrorAction SilentlyContinue }}
                    }} catch {{ }}
                }}
                """
                
                def check_is_installed():
                    ver = RegistryService.fetch_installed_applications(target_host, username, password)
                    if not ver.get("success"):
                        return True 
                    return any(a["name"] == app_name for a in ver.get("apps", []))

                still_installed = True
                success_method = "Primary Registry String"
                
                # --- TIMER 1: Primary Method (Max ~84 seconds wasted if hung) ---
                primary_start = time.time()
                winrm_client.run_powershell(ps_script)

                host_status.progress_percent = 70
                host_status.log_output = "Verifying registry string uninstallation status..."
                db.session.commit()
                
                # Check immediately, sleep briefly (max 24 seconds total wait)
                for _ in range(8):
                    if not check_is_installed():
                        still_installed = False
                        break
                    time.sleep(3)
                    
                primary_elapsed = time.time() - primary_start

                # --- TIMER 2: WMI Fallback ---
                if still_installed:
                    host_status.progress_percent = 80
                    host_status.log_output = f"registry string method failed ({primary_elapsed:.1f}s). Attempting WMI uninstallation for {app_name}"
                    db.session.commit()
                    
                    wmi_start = time.time()
                    wmi_script = f'wmic product where "name like \'%{app_name}%\'" call uninstall /nointeractive'
                    winrm_client.run_powershell(wmi_script)
                    
                    # Dropped to 5 checks (max 15 seconds)
                    for _ in range(5):
                        if not check_is_installed():
                            still_installed = False
                            success_method = "WMI Fallback"
                            break
                        time.sleep(3)
                        
                    wmi_elapsed = time.time() - wmi_start

                    # --- TIMER 3: Package Management Fallback ---
                    if still_installed:
                        host_status.progress_percent = 90
                        host_status.log_output = f"WMI method failed ({wmi_elapsed:.1f}s). Attempting PackageManagement uninstallation for {app_name}"
                        db.session.commit()
                        
                        pkg_start = time.time()
                        pkg_script = f'Get-Package -Name "{app_name}" -ErrorAction SilentlyContinue | Uninstall-Package -Force -ErrorAction SilentlyContinue'
                        winrm_client.run_powershell(pkg_script)
                        
                        # Dropped to 5 checks (max 15 seconds)
                        for _ in range(5):
                            if not check_is_installed():
                                still_installed = False
                                success_method = "PackageManagement Fallback"
                                break
                            time.sleep(3)
                            
                        pkg_elapsed = time.time() - pkg_start

                # --- Final Result ---
                if still_installed:
                    host_status.status = "FAILED"
                    host_status.progress_percent = 100
                    host_status.log_output = f"Verification Failed: '{app_name}' is still installed after all attempts."
                else:
                    host_status.status = "SUCCESS"
                    host_status.progress_percent = 100
                    
                    if success_method == "Primary Registry String":
                        final_time = primary_elapsed
                    elif success_method == "WMI Fallback":
                        final_time = primary_elapsed + wmi_elapsed
                    else:
                        final_time = primary_elapsed + wmi_elapsed + pkg_elapsed
                        
                    host_status.log_output = f"Successfully verified uninstallation of {app_name} (v{matched_app['version']}) via {success_method} in {final_time:.1f}s."

            db.session.commit()
            return {"status": host_status.status, "host": target_host}

        except Exception as e:
            host_status.status = "FAILED"
            host_status.progress_percent = 100
            host_status.log_output = f"Unexpected Error: {str(e)}"
            db.session.commit()
            return {"status": "FAILED", "error": str(e)}


@celery_app.task(bind=True, name="app.tasks.finalize_job")
def finalize_job(self, results, job_id):
    app = get_flask_app()
    with app.app_context():
        job = Job.query.get(job_id)
        if job:
            job.status = "COMPLETED"
            db.session.commit()
            
    return {"status": "COMPLETED", "job_id": job_id}


@celery_app.task(bind=True, name="app.tasks.execute_bulk_operation")
def execute_bulk_operation(self, job_id, credentials, server_host="localhost"):
    app = get_flask_app()
    with app.app_context():
        job = Job.query.get(job_id)
        if not job:
            return {"status": "ERROR", "message": f"Job {job_id} not found"}

        job.status = "RUNNING"
        db.session.commit()

        hosts = HostStatus.query.filter_by(job_id=job_id).all()

        subtasks = [
            process_single_host.s(
                host_status_id=h.id,
                action=job.action,
                credentials=credentials,
                installer_path=job.installer_path,
                app_name=job.app_name,
                uninstall_key=job.uninstall_key,
                server_host=server_host
            )
            for h in hosts
        ]

        chord(subtasks)(finalize_job.s(job_id=job_id))

        return {"status": "LAUNCHED", "job_id": job_id}
