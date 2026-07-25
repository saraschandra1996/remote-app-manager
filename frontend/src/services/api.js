import axios from 'axios';

const API_BASE = '/api';

export const healthCheck = () => axios.get(`${API_BASE}/health`);

export const discoverApps = (payload) => 
  axios.post(`${API_BASE}/apps/discover`, payload);

export const createJob = (payload) => 
  axios.post(`${API_BASE}/jobs`, payload);

export const getJobStatus = (jobId) => 
  axios.get(`${API_BASE}/jobs/${jobId}`);
