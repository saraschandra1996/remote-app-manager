import json
import winrm
from winrm.exceptions import WinRMTransportError, WinRMError

class WinRMService:
    def __init__(self, target_host, username, password, use_ssl=False, port=None):
        self.target_host = target_host
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.port = port or (5986 if use_ssl else 5985)
        self.scheme = "https" if use_ssl else "http"
        self.endpoint = f"{self.scheme}://{self.target_host}:{self.port}/wsman"

    def _get_session(self):
        """Creates a PyWinRM session targeting the Windows machine."""
        return winrm.Session(
            self.endpoint,
            auth=(self.username, self.password),
            transport='ntlm',
            server_cert_validation='ignore'
        )

    def run_powershell(self, script, timeout_seconds=300):
        """
        Executes an encoded/raw PowerShell script over WinRM.
        Returns a dict: {'success': bool, 'stdout': str, 'stderr': str, 'status_code': int}
        """
        try:
            session = self._get_session()
            result = session.run_ps(script)
            
            stdout = result.std_out.decode('utf-8', errors='ignore').strip()
            stderr = result.std_err.decode('utf-8', errors='ignore').strip()
            
            return {
                "success": result.status_code == 0,
                "stdout": stdout,
                "stderr": stderr,
                "status_code": result.status_code
            }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"WinRM Connection Error: {str(e)}",
                "status_code": -1
            }
