import React from 'react';
import { Server, Activity } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Server className="w-8 h-8 text-indigo-400" />
        <h1 className="text-xl font-bold text-white tracking-wide">
          Remote App Manager <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded ml-2">Docker / WinRM</span>
        </h1>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => setActiveTab('deploy')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'deploy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          Deployment & Task Runner
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'
          }`}
        >
          Job History
        </button>
      </div>
    </nav>
  );
}
