// Registers the service worker that makes the app installable and
// available offline. No-op during local dev (Vite serves from /src).
export function registerSW(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL ?? '/';
    navigator.serviceWorker.register(`${base}sw.js`).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
