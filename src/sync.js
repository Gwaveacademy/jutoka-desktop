/**
 * Jutoka Desktop — Auth & Sync Module
 * Handles authentication token storage and project syncing with the web app
 */

const Store = require('electron-store');
const store = new Store();

const JUTOKA_API = 'https://jutoka.com/api';

class JutokaSync {
  constructor() {
    this.token = store.get('authToken', null);
  }

  setToken(token) {
    this.token = token;
    store.set('authToken', token);
  }

  clearToken() {
    this.token = null;
    store.delete('authToken');
  }

  isAuthenticated() {
    return !!this.token;
  }

  async getProjects() {
    if (!this.token) throw new Error('Not authenticated');
    const res = await fetch(`${JUTOKA_API}/projects`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async getRenderJobs() {
    if (!this.token) throw new Error('Not authenticated');
    const res = await fetch(`${JUTOKA_API}/render-jobs?status=pending&desktop=true`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async updateRenderJob(jobId, data) {
    if (!this.token) throw new Error('Not authenticated');
    const res = await fetch(`${JUTOKA_API}/render-jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async uploadRenderedFile(filePath, jobId) {
    if (!this.token) throw new Error('Not authenticated');
    const fs = require('fs');
    const FormData = require('form-data');

    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('file', fileBuffer, path.basename(filePath));
    formData.append('jobId', jobId);

    const res = await fetch(`${JUTOKA_API}/upload-render`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  }

  // Poll for pending render jobs from the web app
  startPolling(intervalMs = 10000, onJob) {
    this.pollInterval = setInterval(async () => {
      if (!this.isAuthenticated()) return;
      try {
        const jobs = await this.getRenderJobs();
        if (jobs.length > 0 && onJob) {
          for (const job of jobs) {
            onJob(job);
          }
        }
      } catch (err) {
        console.error('[Jutoka Sync] Polling error:', err.message);
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

module.exports = JutokaSync;
