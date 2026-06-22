export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
}

export function formatTokens(n: number): string {
  if (n < 0) return '0';
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatResetTime(epochSeconds: number): string | null {
  if (!Number.isSafeInteger(epochSeconds) || epochSeconds <= 0) return null;
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${hours}:${minutes} ${day} ${MONTHS[date.getMonth()]}`;
}

export function formatRateLimitWindow(minutes: number | null, fallback: string): string {
  if (minutes === null || !Number.isSafeInteger(minutes) || minutes <= 0) return fallback;
  if (minutes % 1_440 === 0) return `${minutes / 1_440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
