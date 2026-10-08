// api.js - Centralized API client for INDUSTRIA 3D
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ─── Health ───────────────────────────────────────────────────────────────────
export const fetchHealth = () => api.get('/api/health').then(r => r.data);

// ─── Components ───────────────────────────────────────────────────────────────
export const fetchComponents = () => api.get('/api/components').then(r => r.data);
export const fetchComponent = (id) => api.get(`/api/components/${id}`).then(r => r.data);
export const fetchHistory = (id) => api.get(`/api/components/${id}/history`).then(r => r.data);
export const fetchPrediction = (id) => api.get(`/api/components/${id}/prediction`).then(r => r.data);
export const fetchPredictiveMaintenance = (id) => api.get(`/api/components/${id}/predictive-maintenance`).then(r => r.data);
export const simulateWhatIf = (id, params) => api.post(`/api/components/${id}/what-if`, params).then(r => r.data);
export const fetchHydraulicData = () => api.get('/api/hydraulic-data').then(r => r.data);


// ─── Inspection Upload (supports multiple images) ────────────────────────────
export const uploadInspection = (componentId, files, notes, onProgress) => {
  const form = new FormData();
  form.append('component_id', componentId);

  // Accept single file or array of files
  const fileList = Array.isArray(files) ? files : [files];
  fileList.forEach((file) => {
    form.append('files', file);
  });

  if (notes) form.append('notes', notes);

  return api.post('/api/inspect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  }).then(r => r.data);
};

// ─── 3D Model Upload ──────────────────────────────────────────────────────────
export const uploadModel = (componentId, file) => {
  const form = new FormData();
  form.append('component_id', componentId);
  form.append('model_file', file);
  return api.post('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ─── KIRI Engine 3D Photogrammetry ───────────────────────────────────────────
export const fetchKiriBalance = () => api.get('/api/kiri/balance').then(r => r.data);
export const fetchKiriTasks = () => api.get('/api/kiri/tasks').then(r => r.data);
export const fetchKiriStatus = (serialize) => api.get(`/api/kiri/status/${serialize}`).then(r => r.data);
export const syncKiriModel = (serialize) => api.post(`/api/kiri/sync/${serialize}`).then(r => r.data);

export const reconstructKiri3D = (componentId, files, options = {}, onProgress) => {
  const form = new FormData();
  form.append('component_id', componentId);
  form.append('model_quality', options.modelQuality ?? 1);
  form.append('texture_quality', options.textureQuality ?? 1);

  Array.from(files).forEach((file) => {
    form.append('files', file);
  });

  return api.post('/api/kiri/reconstruct', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  }).then(r => r.data);
};

export default api;
