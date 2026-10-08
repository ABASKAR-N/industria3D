// utils.js - Shared utility helpers

export const riskLevel = (health) => {
  if (health >= 80) return 'LOW';
  if (health >= 60) return 'MEDIUM';
  if (health >= 40) return 'HIGH';
  return 'CRITICAL';
};

export const riskColor = (level) => {
  const map = {
    LOW: '#22c55e',
    MEDIUM: '#eab308',
    HIGH: '#f97316',
    CRITICAL: '#ef4444',
  };
  return map[level] || '#94a3b8';
};

export const severityColor = (severity) => {
  const map = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };
  return map[severity?.toLowerCase()] || '#94a3b8';
};

export const healthColor = (health) => {
  if (health >= 80) return '#22c55e';
  if (health >= 60) return '#eab308';
  if (health >= 40) return '#f97316';
  return '#ef4444';
};

export const formatDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const relativeTime = (ts) => {
  if (!ts) return '—';
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const badgeClass = (level) => {
  const map = {
    LOW: 'badge-green',
    MEDIUM: 'badge-yellow',
    HIGH: 'badge-orange',
    CRITICAL: 'badge-red',
  };
  return `badge ${map[level] || 'badge-cyan'}`;
};

export const severityBadge = (severity) => {
  const map = {
    low: 'badge-green',
    medium: 'badge-yellow',
    high: 'badge-orange',
    critical: 'badge-red',
  };
  return `badge ${map[severity?.toLowerCase()] || 'badge-cyan'}`;
};
