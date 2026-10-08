// Home screen / browser icon choice. Stored per device, since the icon is a device-level thing.
// iOS reads apple-touch-icon when the app is added to the home screen, so a change here
// shows on the home screen only after the app is removed and added again.

const BASE = import.meta.env.BASE_URL;

export const APP_ICONS = [
  { id: 'classic', label: 'Classic', light: `${BASE}icons/icon-light.png`, dark: `${BASE}icons/icon-dark.png` },
  { id: 'shift-bar', label: 'Shift Bar' },
  { id: 'month-log', label: 'Month Log' },
  { id: 'bento', label: 'Bento' },
  { id: 'check-in', label: 'Check In' },
  { id: 'timecard', label: 'Timecard' },
].map((icon) => ({
  light: `${BASE}icons/app/${icon.id}-light-180.png`,
  dark: `${BASE}icons/app/${icon.id}-dark-180.png`,
  ...icon,
}));

const STORAGE_KEY = 'appIcon';
const DEFAULT_ICON = 'classic';

export const getAppIcon = () => {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return APP_ICONS.some((icon) => icon.id === id) ? id : DEFAULT_ICON;
  } catch {
    return DEFAULT_ICON;
  }
};

const setLink = (id, rel, href, media) => {
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    document.head.appendChild(link);
  }
  link.rel = rel;
  link.href = href;
  if (media) link.media = media;
  else link.removeAttribute('media');
};

export const applyAppIcon = (id = getAppIcon()) => {
  const icon = APP_ICONS.find((i) => i.id === id) ?? APP_ICONS[0];
  setLink('apple-touch-icon-light', 'apple-touch-icon', icon.light);
  setLink('apple-touch-icon-dark', 'apple-touch-icon', icon.dark, '(prefers-color-scheme: dark)');
  if (icon.id !== 'classic') {
    setLink('favicon-light', 'icon', icon.light, '(prefers-color-scheme: light)');
    setLink('favicon-dark', 'icon', icon.dark, '(prefers-color-scheme: dark)');
  } else {
    setLink('favicon-light', 'icon', `${BASE}icons/favicon-light.png`, '(prefers-color-scheme: light)');
    setLink('favicon-dark', 'icon', `${BASE}icons/favicon-dark.png`, '(prefers-color-scheme: dark)');
  }
};

export const setAppIcon = (id) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
  applyAppIcon(id);
};
