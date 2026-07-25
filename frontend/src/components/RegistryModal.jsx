import React, { useState } from 'react';
import { X, Search, Trash2, CheckCircle2 } from 'lucide-react';

export default function RegistryModal({ apps, sampleHost, onConfirm, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);

  const filteredApps = apps.filter(app => 
    (app.name && app.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (app.publisher && app.publisher.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Select Application to Uninstall</h3>
            <p className="text-xs text-slate-400">Primary Target Host: <span className="text-indigo-400 font-mono">{sampleHost}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search installed applications or publishers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Application List Container */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 max-h-[50vh]">
          {filteredApps.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No matching applications found on {sampleHost}.</p>
          ) : (
            filteredApps.map((app, idx) => {
              const isSelected = selectedApp?.name === app.name;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedApp(app)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                    isSelected 
                      ? 'bg-rose-950/60 border-rose-500 text-white' 
                      : 'bg-slate-900/80 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}
                >
                  <div className="pr-4 overflow-hidden">
                    <p className="text-sm font-semibold text-white">{app.name}</p>
                    <p className="text-xs text-slate-400">
                      Version: <span className="text-indigo-300">{app.version}</span> | Publisher: {app.publisher}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono truncate max-w-xl mt-1">{app.uninstall_string}</p>
                  </div>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm font-medium">
            Cancel
          </button>
          <button
            disabled={!selectedApp}
            onClick={() => onConfirm(selectedApp)}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Uninstall Selected Application Across All Systems
          </button>
        </div>

      </div>
    </div>
  );
}
