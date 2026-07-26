import JobHistory from './components/JobHistory';
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HostForm from './components/HostForm';
import ProgressTracker from './components/ProgressTracker';
import RegistryModal from './components/RegistryModal';
import { createJob, discoverApps, getJobStatus, cancelJob, cancelHostTask } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('deploy');
  const [loading, setLoading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [appsModalData, setAppsModalData] = useState(null);
  const [pendingUninstallData, setPendingUninstallData] = useState(null);

  // --- NEW: On Initial Load, check if we left a job running ---
  useEffect(() => {
    const savedJobId = localStorage.getItem('activeJobId');
    if (savedJobId) {
      getJobStatus(savedJobId)
        .then(res => {
          setActiveJob(res.data);
          // If it already finished while we were gone, clean up storage
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(res.data.status)) {
            localStorage.removeItem('activeJobId');
          }
        })
        .catch(err => {
          console.error('Failed to reconnect to saved job:', err);
          localStorage.removeItem('activeJobId');
        });
    }
  }, []);

  // --- UPDATED: Poll job status every 3 seconds if active & manage localStorage ---
  useEffect(() => {
    let interval;
    const isJobActive = activeJob?.status === 'RUNNING' || activeJob?.status === 'IN_PROGRESS' || activeJob?.status === 'PENDING';

    if (activeJob?.job_id && isJobActive) {
      // Save it so we remember it on refresh
      localStorage.setItem('activeJobId', activeJob.job_id);
      
      interval = setInterval(async () => {
        try {
          const res = await getJobStatus(activeJob.job_id);
          setActiveJob(res.data);
          
          // Clean up when finished
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(res.data.status)) {
            localStorage.removeItem('activeJobId');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Error fetching job status:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

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

  const handleCancelJob = async () => {
    if (!activeJob?.job_id) return;
    setActiveJob(prev => ({ ...prev, status: 'CANCELLED' }));
    try {
      await cancelJob(activeJob.job_id);
      const res = await getJobStatus(activeJob.job_id);
      setActiveJob(res.data);
      localStorage.removeItem('activeJobId'); // Clean up on cancel
    } catch (err) {
      alert('Failed to cancel job: ' + (err.response?.data?.error || err.message));
      const res = await getJobStatus(activeJob.job_id);
      setActiveJob(res.data);
    }
  };

  const handleCancelHost = async (hostId) => {
    if (!activeJob?.job_id) return;
    setActiveJob(prev => ({
      ...prev,
      hosts: prev.hosts.map(h => h.id === hostId ? { ...h, status: 'CANCELLED' } : h)
    }));
    try {
      await cancelHostTask(activeJob.job_id, hostId);
      const res = await getJobStatus(activeJob.job_id);
      setActiveJob(res.data);
    } catch (err) {
      alert('Failed to cancel host task: ' + (err.response?.data?.error || err.message));
      const res = await getJobStatus(activeJob.job_id);
      setActiveJob(res.data);
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
            <ProgressTracker 
              job={activeJob} 
              onCancel={handleCancelJob} 
              onCancelHost={handleCancelHost} 
            />
          </div>
        ) : (
	  <JobHistory />
        )}
      </main>

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
