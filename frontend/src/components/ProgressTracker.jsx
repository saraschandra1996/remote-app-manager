import React from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function ProgressTracker({ job }) {
  if (!job) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> Completed</span>;
      case 'IN_PROGRESS':
      case 'RUNNING':
        return <span className="flex items-center gap-1 text-indigo-400 text-xs font-semibold bg-indigo-950/60 border border-indigo-800 px-2.5 py-1 rounded-full animate-pulse"><Activity className="w-3.5 h-3.5" /> Processing</span>;
      case 'FAILED':
        return <span className="flex items-center gap-1 text-rose-400 text-xs font-semibold bg-rose-950/60 border border-rose-800 px-2.5 py-1 rounded-full"><XCircle className="w-3.5 h-3.5" /> Failed</span>;
      case 'MISMATCH':
        return <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5" /> Version Mismatch</span>;
      default:
        return <span className="flex items-center gap-1 text-slate-400 text-xs font-semibold bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full"><Clock className="w-3.5 h-3.5" /> Pending</span>;
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl space-y-4">
      <div className="flex justify-between items-center pb-4 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Active Job Status <span className="text-xs text-indigo-400 font-mono bg-indigo-950 px-2 py-0.5 rounded">ID: {job.job_id?.substring(0, 8)}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Action: <strong className="text-slate-200">{job.action}</strong></p>
        </div>
        {getStatusBadge(job.status)}
      </div>

      <div className="space-y-3">
        {job.hosts?.map((host, idx) => (
          <div key={idx} className="bg-slate-900/80 border border-slate-700/80 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white font-mono">{host.fqdn}</p>
                <p className="text-xs text-slate-400">{host.log_output || 'Awaiting task execution...'}</p>
              </div>
              {getStatusBadge(host.status)}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  host.status === 'SUCCESS' ? 'bg-emerald-500' : host.status === 'FAILED' ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${host.progress_percent || (host.status === 'SUCCESS' ? 100 : 15)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
