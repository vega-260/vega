import api from '../services/api.ts';

/**
 * Resolves a raw avatar or photo URL to a fully qualified URL if needed.
 */
export function resolveAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Handle relative uploads or local assets
  const apiBase = api?.defaults?.baseURL || '';
  const serverOrigin = apiBase.replace(/\/api\/?$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  
  return `${serverOrigin}${normalizedPath}`;
}

/**
 * Generates uppercase 1-2 character initials for a user.
 */
export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0]?.[0] || 'U').toUpperCase();
  }

  if (email && email.trim()) {
    const handle = email.split('@')[0];
    return (handle?.[0] || 'U').toUpperCase();
  }

  return 'U';
}

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-blue-600 to-indigo-600',
  'from-violet-600 to-purple-700',
  'from-cyan-500 to-blue-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
];

/**
 * Generates a deterministic gradient class pair based on user identifier.
 */
export function getAvatarGradient(seed?: string | null): string {
  if (!seed) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

/**
 * Returns an inline SVG data URI as an ultimate zero-network fallback avatar.
 */
export function getSvgAvatarDataUri(name?: string | null, email?: string | null): string {
  const initials = getInitials(name, email);
  const colors = [
    ['#6366f1', '#9333ea'],
    ['#2563eb', '#4f46e5'],
    ['#7c3aed', '#9333ea'],
    ['#06b6d4', '#2563eb'],
    ['#a855f7', '#ec4899'],
    ['#10b981', '#0d9488'],
  ];
  
  let hash = 0;
  const seed = (name || email || 'user').trim();
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const [c1, c2] = colors[Math.abs(hash) % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#g)" rx="50" />
    <text x="50" y="54" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="40" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
