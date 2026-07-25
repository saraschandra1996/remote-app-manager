import json
from app.services.winrm_service import WinRMService

class RegistryService:
    
    # PowerShell script to query both 64-bit and 32-bit registry uninstall keys
    GET_INSTALLED_APPS_PS = """
    $paths = @(
        "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
    )
    
    $apps = Get-ItemProperty $paths -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -and $_.UninstallString } | 
        Select-Object DisplayName, DisplayVersion, Publisher, UninstallString, PSChildName |
        Sort-Object DisplayName

    $apps | ConvertTo-Json -Depth 3
    """

    @staticmethod
    def fetch_installed_applications(target_host, username, password, use_ssl=False):
        """
        Connects to a single target machine to discover all installed applications
        via the Windows Registry.
        """
        winrm_client = WinRMService(target_host, username, password, use_ssl)
        res = winrm_client.run_powershell(RegistryService.GET_INSTALLED_APPS_PS)

        if not res["success"]:
            return {"success": False, "error": res["stderr"], "apps": []}

        try:
            raw_json = res["stdout"]
            if not raw_json:
                return {"success": True, "apps": []}
            
            data = json.loads(raw_json)
            # Ensure output is always a list even if a single item is returned
            apps = data if isinstance(data, list) else [data]
            
            formatted_apps = []
            for item in apps:
                formatted_apps.append({
                    "name": item.get("DisplayName"),
                    "version": item.get("DisplayVersion") or "Unknown",
                    "publisher": item.get("Publisher") or "Unknown",
                    "uninstall_string": item.get("UninstallString"),
                    "registry_key": item.get("PSChildName")
                })
                
            return {"success": True, "apps": formatted_apps}
        except Exception as parse_err:
            return {"success": False, "error": f"JSON Parse Error: {str(parse_err)}", "apps": []}

    @staticmethod
    def execute_registry_uninstall(target_host, username, password, uninstall_string, use_ssl=False):
        """
        Executes a silent uninstallation on a target host using its registry uninstall command.
        Converts MsiExec commands to silent mode (/qn /norestart) automatically.
        """
        winrm_client = WinRMService(target_host, username, password, use_ssl)
        
        # Modify msiexec to execute silently without rebooting
        clean_uninstall_cmd = uninstall_string.replace("/I", "/X").replace("/i", "/x")
        if "msiexec" in clean_uninstall_cmd.lower() and "/qn" not in clean_uninstall_cmd.lower():
            clean_uninstall_cmd += " /qn /norestart"

        script = f"""
        $cmd = '{clean_uninstall_cmd}'
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c $cmd" -Wait -NoNewWindow
        """
        
        return winrm_client.run_powershell(script)
