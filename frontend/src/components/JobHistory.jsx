import React, { useState, useEffect } from 'react';
import { Clock, Activity, CheckCircle, XCircle, Ban, ChevronDown, ChevronUp, User, Download, Search, Calendar } from 'lucide-react';
import { getAllJobs, cancelJob } from '../services/api';

export default function JobHistory() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  
  // Filter States
  const [adminFilter, setAdminFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await getAllJobs();
      setJobs(res.data.jobs || []);
    } catch (error) {
      console.error("Failed to fetch job history:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (jobId) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleCancelStuckJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to forcefully cancel this job?")) return;
    setJobs(currentJobs => currentJobs.map(j => j.job_id === jobId ? { ...j, status: 'CANCELLED' } : j));
    try {
      await cancelJob(jobId);
      fetchJobs();
    } catch (error) {
      alert('Failed to cancel job: ' + (error.response?.data?.error || error.message));
      fetchJobs(); 
    }
  };

  const handleCancelAllActive = async () => {
    const activeJobs = jobs.filter(j => ['RUNNING', 'IN_PROGRESS', 'PENDING'].includes(j.status));
    if (!window.confirm(`Are you sure you want to forcefully cancel all ${activeJobs.length} active jobs?`)) return;
    setJobs(currentJobs => currentJobs.map(j => ['RUNNING', 'IN_PROGRESS', 'PENDING'].includes(j.status) ? { ...j, status: 'CANCELLED' } : j));
    try {
      await Promise.all(activeJobs.map(job => cancelJob(job.job_id)));
    } catch (error) {
      alert("One or more cancellations failed.");
    } finally {
      fetchJobs();
    }
  };

  // --- Date Parsing Utility to force IST ---
  const getISTDateObject = (utcString) => {
    // Append 'Z' if missing to ensure JavaScript treats it as UTC before converting
    const safeUtcString = utcString.endsWith('Z') ? utcString : `${utcString}Z`;
    return new Date(safeUtcString);
  };

  // --- Filtering Logic ---
  const filteredJobs = jobs.filter(job => {
    // 1. Admin Filter
    if (adminFilter.trim()) {
      const adminName = job.admin_username ? job.admin_username.split('\\').pop().toLowerCase() : 'unknown';
      if (!adminName.includes(adminFilter.toLowerCase().trim())) return false;
    }

    // 2. Date Range Filter (Evaluated in IST)
    const jobDateObj = getISTDateObject(job.created_at);
    // Format to YYYY-MM-DD in IST for easy string comparison with the calendar inputs
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' 
    });
    const jobDateISTStr = formatter.format(jobDateObj); 

    if (startDate && jobDateISTStr < startDate) return false;
    if (endDate && jobDateISTStr > endDate) return false;

    return true;
  });

  // --- CSV Export Logic (Expanded per Host) ---
  const exportToCSV = () => {
    const headers = ['JOB ID', 'Date', 'Time', 'Admin Username', 'Action', 'Target APP/File', 'Status', 'Hosts', 'Hosts Status'];
    const rows = [];

    filteredJobs.forEach(job => {
      const admin = job.admin_username ? job.admin_username.split('\\').pop() : 'Unknown';
      const targetApp = job.app_name || 'Uploaded File';
      
      const jobDateObj = getISTDateObject(job.created_at);
      const dateStr = jobDateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }); // e.g., 7/26/2026
      const timeStr = jobDateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }); // e.g., 3:26:38 PM

      // If the job has no hosts, log a single row indicating that
      if (!job.hosts || job.hosts.length === 0) {
        rows.push([job.job_id, dateStr, timeStr, admin, job.action, targetApp, job.status, 'No Host Data', 'N/A']);
      } else {
        // Create one row per individual host
        job.hosts.forEach(host => {
          rows.push([
            job.job_id,
            dateStr,
            timeStr,
            admin,
            job.action,
            targetApp,
            job.status,
            host.fqdn,
            host.status
          ]);
        });
      }
    });

    // Safely escape fields (especially those with commas)
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Job_Audit_Log_IST_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'SUCCESS':
        return <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-max"><CheckCircle className="w-3 h-3"/> Completed</span>;
      case 'RUNNING':
      case 'IN_PROGRESS':
        return <span className="text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-max animate-pulse"><Activity className="w-3 h-3"/> Running</span>;
      case 'FAILED':
        return <span className="text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-max"><XCircle className="w-3 h-3"/> Failed</span>;
      case 'CANCELLED':
        return <span className="text-slate-400 bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-max"><Ban className="w-3 h-3"/> Cancelled</span>;
      default:
        return <span className="text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Pending</span>;
    }
  };

  if (loading) return <div className="text-center text-slate-400 py-10 animate-pulse">Loading job history...</div>;

  const activeJobsCount = jobs.filter(j => ['RUNNING', 'IN_PROGRESS', 'PENDING'].includes(j.status)).length;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
      
      {/* Header and Filter Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-white shrink-0">Job History Audit Logs</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          
          {/* Calendar Date Range Filters */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none placeholder-slate-500 [color-scheme:dark]"
              title="Start Date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-slate-200 focus:outline-none placeholder-slate-500 [color-scheme:dark]"
              title="End Date"
            />
          </div>

          {/* Admin Filter Input */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by Admin..."
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Export CSV Button */}
          <button 
            onClick={exportToCSV}
            disabled={filteredJobs.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          {activeJobsCount > 0 && (
            <button onClick={handleCancelAllActive} className="flex items-center gap-2 px-4 py-1.5 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/50 hover:border-rose-500 text-rose-400 hover:text-white rounded-lg text-sm font-semibold transition-all duration-200">
              <Ban className="w-4 h-4" /> Cancel All Active ({activeJobsCount})
            </button>
          )}
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-500">No jobs found matching your criteria.</p>
          {(adminFilter || startDate || endDate) && (
            <button 
              onClick={() => { setAdminFilter(''); setStartDate(''); setEndDate(''); }} 
              className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="pb-3 w-8"></th>
                <th className="pb-3 font-medium pl-2">Job ID</th>
                <th className="pb-3 font-medium">Date (IST)</th>
                <th className="pb-3 font-medium">Admin</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Target App / File</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredJobs.map((job) => {
                const isActive = job.status === 'RUNNING' || job.status === 'IN_PROGRESS' || job.status === 'PENDING';
                const isExpanded = expandedJobs.has(job.job_id);
                
                return (
                  <React.Fragment key={job.job_id}>
                    <tr 
                      className={`border-b border-slate-700/50 hover:bg-slate-700/20 transition cursor-pointer ${isExpanded ? 'bg-slate-700/20' : ''}`}
                      onClick={() => toggleExpand(job.job_id)}
                    >
                      <td className="py-4 pl-2 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </td>
                      <td className="py-4 text-indigo-300 font-mono text-xs">{job.job_id.substring(0, 8)}</td>
                      <td className="py-4 text-slate-300">
                        {getISTDateObject(job.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>
                      <td className="py-4 text-slate-300 flex items-center gap-1 mt-3">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {job.admin_username ? job.admin_username.split('\\').pop() : 'Unknown'}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${job.action === 'INSTALL' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-rose-900/50 text-rose-300'}`}>
                          {job.action}
                        </span>
                      </td>
                      <td className="py-4 text-slate-300 truncate max-w-[150px]" title={job.app_name || 'Uploaded File'}>
                        {job.app_name || 'Uploaded File'}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(job.status)}
                          {isActive && (
                            <button onClick={(e) => { e.stopPropagation(); handleCancelStuckJob(job.job_id); }} className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan="7" className="p-0 border-b border-slate-700">
                          <div className="bg-slate-900 p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase">Target Hosts Execution Log</h4>
                            {job.hosts?.length > 0 ? (
                              <div className="space-y-2">
                                {job.hosts.map((host, idx) => (
                                  <div key={idx} className="bg-slate-800 border border-slate-700 p-3 rounded flex justify-between items-center">
                                    <div className="w-2/3">
                                      <p className="text-sm text-white font-mono">{host.fqdn}</p>
                                      <p className="text-xs text-slate-400 truncate" title={host.log_output}>{host.log_output || 'No logs recorded.'}</p>
                                    </div>
                                    <div className="w-1/3 flex justify-end">
                                      {getStatusBadge(host.status)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No host data available for this job.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
