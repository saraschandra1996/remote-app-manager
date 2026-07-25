import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HostForm from './components/HostForm';
import ProgressTracker from './components/ProgressTracker';
import RegistryModal from './components/RegistryModal';
import { createJob, discoverApps, getJobStatus } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('deploy');
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [appsModalData, setAppsModalData] = useState(null);
  const [pendingUninstallData, setPendingUninstallData] = useState(null);

  // Poll job status every 3 seconds if active
  useEffect(() => {
    let interval;
    if (activeJob?.job_id && activeJob.status === 'RUNNING') {
      interval = setInterval(async () => {
        try {
          const res = await getJobStatus(activeJob.job_id);
          setActiveJob(res.data);
        } catch (err) {
          console.error('Error fetching job status:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

  // Handle Installation Submission
  const handleInstallSubmit = async (payload) => {
    setLoading(true);
    try {
      const res = await createJob(payload);
      setActiveJob({ job_id: res.data.job_id, action: payload.action, status: 'RUNNING', hosts: [] });
    } catch (err) {
      alert('Failed to trigger installation task: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle Application Discovery for Uninstallation
  const handleDiscoverApps = async ({ sample_host, domain, username, password, hostList }) => {
    setLoading(true);
    try {
      const res = await discoverApps({ sample_host, domain, username, password });
      setAppsModalData({ apps: res.data.applications, sampleHost: res.data.host });
      setPendingUninstallData({ domain, hostnames: hostList, username, password });
    } catch (err) {
      alert('Registry Discovery Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle Final Uninstallation Trigger from Modal
  const handleConfirmUninstall = async (selectedApp) => {
    if (!pendingUninstallData) return;
    setAppsModalData(null);
    setLoading(true);

    try {
      const payload = {
        action: 'UNINSTALL',
        app_name: selectedApp.name,
        uninstall_key: selectedApp.uninstall_string,
        ...pendingUninstallData
      };
      const res = await createJob(payload);
      setActiveJob({ job_id: res.data.job_id, action: 'UNINSTALL', status: 'RUNNING', hosts: [] });
    } catch (err) {
      alert('Failed to trigger uninstallation job: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'deploy' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <HostForm 
              onSubmit={handleInstallSubmit} 
              onDiscoverApps={handleDiscoverApps} 
              loading={loading} 
            />
            <ProgressTracker job={activeJob} />
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center text-slate-400">
            Job History Audit Logs view will display past execution logs stored in SQLite.
          </div>
        )}
      </main>

      {/* Registry Application Selector Modal */}
      {appsModalData && (
        <RegistryModal
          apps={appsModalData.apps}
          sampleHost={appsModalData.sampleHost}
          onConfirm={handleConfirmUninstall}
          onClose={() => setAppsModalData(null)}
        />
      )}
    </div>
  );
}
