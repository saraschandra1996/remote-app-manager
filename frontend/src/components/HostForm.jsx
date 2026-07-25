import React, { useState } from 'react';
import { Play, Search, Shield, HardDrive, Globe, AlertTriangle } from 'lucide-react';

export default function HostForm({ onSubmit, onDiscoverApps, loading }) {
  const [action, setAction] = useState('INSTALL');
  const [domain, setDomain] = useState('');
  const [hostnames, setHostnames] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [installerPath, setInstallerPath] = useState('');

  const handleActionSubmit = (e) => {
    e.preventDefault();
    const hostList = hostnames.split(/[\n,]+/).map(h => h.trim()).filter(Boolean);

    if (hostList.length === 0) {
      alert('Please enter at least one target hostname.');
      return;
    }

    if (action === 'UNINSTALL') {
      // For uninstallation, sample from the first host in the list
      onDiscoverApps({
        sample_host: hostList[0],
        domain,
        username,
        password,
        hostList
      });
    } else {
      onSubmit({
        action,
        domain,
        hostnames: hostList,
        username,
        password,
        installerPath
      });
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-indigo-400" /> Action & Target Machines Setup
      </h2>

      <form onSubmit={handleActionSubmit} className="space-y-5">
        {/* Action Toggle */}
        <div className="grid grid-cols-2 gap-3 bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => setAction('INSTALL')}
            className={`py-2 rounded-md font-medium text-sm transition ${
              action === 'INSTALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Remote Installation
          </button>
          <button
            type="button"
            onClick={() => setAction('UNINSTALL')}
            className={`py-2 rounded-md font-medium text-sm transition ${
              action === 'UNINSTALL' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Remote Uninstallation (Registry-based)
          </button>
        </div>

        {/* Domain Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
            <Globe className="w-4 h-4 text-slate-400" /> Domain Name (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. domain.com (automatically builds host.domain.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>

        {/* Target Hostnames */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
            Target Hostnames (One per line or comma-separated)
          </label>
          <textarea
            rows="4"
            placeholder="pc-01&#10;pc-02&#10;pc-03.domain.com"
            value={hostnames}
            onChange={(e) => setHostnames(e.target.value)}
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-mono"
          ></textarea>
        </div>

        {/* Installer Path for Install Action */}
        {action === 'INSTALL' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Installer Path / Command (MSI/EXE)
            </label>
            <input
              type="text"
              placeholder="e.g. \\server\share\installer.msi /quiet"
              value={installerPath}
              onChange={(e) => setInstallerPath(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>
        )}

        {/* Remote Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-700">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
              <Shield className="w-4 h-4 text-slate-400" /> Admin Username
            </label>
            <input
              type="text"
              placeholder="DOMAIN\Administrator"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Admin Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>
        </div>

        {action === 'UNINSTALL' && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-2 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Uninstallation will first query registry keys from <strong>{hostnames.split(/[\n,]+/)[0] || 'the first host'}</strong> to let you pick the target app, then verify version match before executing across all target hosts parallelly.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 shadow-lg transition ${
            action === 'INSTALL' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-rose-600 hover:bg-rose-500'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            'Processing...'
          ) : action === 'INSTALL' ? (
            <> <Play className="w-4 h-4 fill-current" /> Execute Parallel Installation </>
          ) : (
            <> <Search className="w-4 h-4" /> Fetch Registry Applications & Proceed </>
          )}
        </button>
      </form>
    </div>
  );
}
