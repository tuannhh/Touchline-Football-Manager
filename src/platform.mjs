// Build-time selection also works in save workers, without a native bridge.
export const OFFLINE_APP=import.meta.env?.VITE_OFFLINE_APP==='true';
