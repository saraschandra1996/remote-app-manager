import React from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, XCircle, Ban } from 'lucide-react';

export default function ProgressTracker({ job, onCancel, onCancelHost }) {
  if (!job) return null;

  const isActive = job.status === 'RUNNING' || job.status === 'IN_PROGRESS' || job.status === 'PENDING';

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
      case 'CANCELLED':
        return <span className="flex items-center gap-1 text-slate-400 text-xs font-semibold bg-slate-800 border border-slate-600 px-2.5 py-1 rounded-full"><Ban className="w-3.5 h-3.5" /> Cancelled</span>;
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
        
        <div className="flex items-center gap-3">
          {isActive && (
            <button 
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/50 hover:border-rose-500 text-rose-400 hover:text-white rounded-lg text-xs font-semibold transition-all duration-200"
            >
              <Ban className="w-3.5 h-3.5" /> Cancel All
            </button>
          )}
          {getStatusBadge(job.status)}
        </div>
      </div>

      <div className="space-y-3">
        {job.hosts?.map((host, idx) => {
          const isHostActive = host.status === 'RUNNING' || host.status === 'IN_PROGRESS' || host.status === 'PENDING' || host.status === 'SCANNING';
          
          return (
            <div key={idx} className="bg-slate-900/80 border border-slate-700/80 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white font-mono">{host.fqdn}</p>
                  <p className="text-xs text-slate-400">{host.log_output || 'Awaiting task execution...'}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* NEW: Individual Host Cancel Button */}
                  {isHostActive && onCancelHost && (
                    <button
                      onClick={() => onCancelHost(host.id)}
                      title="Cancel this host"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  {getStatusBadge(host.status)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    host.status === 'SUCCESS' ? 'bg-emerald-500' : host.status === 'FAILED' ? 'bg-rose-500' : host.status === 'CANCELLED' ? 'bg-slate-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${host.progress_percent || (host.status === 'SUCCESS' ? 100 : host.status === 'CANCELLED' ? 100 : 15)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
