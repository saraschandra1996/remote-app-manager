import axios from 'axios';

const API_BASE = '/api';

export const healthCheck = () => axios.get(`${API_BASE}/health`);

export const discoverApps = (payload) => 
  axios.post(`${API_BASE}/apps/discover`, payload);

export const createJob = (payload) => 
  axios.post(`${API_BASE}/jobs`, payload);

export const getJobStatus = (jobId) => 
  axios.get(`${API_BASE}/jobs/${jobId}`);

export const cancelJob = (jobId) => 
  axios.post(`${API_BASE}/jobs/${jobId}/cancel`);

export const cancelHostTask = (jobId, hostId) => 
  axios.post(`${API_BASE}/jobs/${jobId}/hosts/${hostId}/cancel`);

// --- NEW FILE UPLOAD ENDPOINTS ---

export const uploadFile = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`${API_BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
};

export const getUploadedFiles = () => 
  axios.get(`${API_BASE}/uploads`);
