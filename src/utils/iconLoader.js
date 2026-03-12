const iconModules = import.meta.glob('../assets/icons/*.svg', { eager: true, as: 'url' });

export const ICONS = Object.fromEntries(
  Object.entries(iconModules).map(([path, url]) => {
    const name = path.split('/').pop().replace('.svg', '').toLowerCase();
    return [name, url];
  })
);

export const ICON_KEYS = Object.keys(ICONS);