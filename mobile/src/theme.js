import { StyleSheet } from 'react-native';

export const darkTheme = {
  primary: '#00AEFF',          // Vibrant Dodger Blue
  primaryDark: '#0085c4',
  background: '#0b0f19',       // Deep Space Obsidian Background
  card: '#162032',             // Sleek Slate-Obsidian Cards
  text: '#ffffff',             // Crisp white text for ultimate contrast
  textMuted: '#94a3b8',        // Cool slate gray for subtitles/secondary text
  border: '#1e293b',           // Sleek borders
  success: '#00DE94',          // Neon Mint Green (Vibrant Success/Cr)
  danger: '#ff4b4b',           // Vibrant alarm red (For danger/Dr transactions)
  adminBg: '#00FFFF',          // Neon Cyan (Highlights & Special Views)
  adminSidebar: '#0f172a',     // Dark Sidebar Background
  
  // Premium UI Status Pill Colors (Neon / Glassmorphic Highlights)
  warning: '#00FF52',          // Neon Lime Green (Attention / Warnings)
  info: '#00FFFF',             // Neon Cyan (Info badges)
  purple: '#9d4edd',           // Neon Electric Purple
  gray: '#475569',             // Sleek Gray
  lightGreen: 'rgba(0, 222, 148, 0.15)',  // Semi-transparent Success background
  lightRed: 'rgba(255, 75, 75, 0.15)',     // Semi-transparent Danger background
  lightWarning: 'rgba(0, 255, 82, 0.15)',  // Semi-transparent Warning background
  lightInfo: 'rgba(0, 255, 255, 0.15)',   // Semi-transparent Info background
  lightPurple: 'rgba(157, 78, 221, 0.15)', // Semi-transparent Purple background
};

export const lightTheme = {
  primary: '#00AEFF',          // Vibrant Dodger Blue (consistent brand primary)
  primaryDark: '#0085c4',
  background: '#f8fafc',       // Crisp light slate background
  card: '#ffffff',             // White card background
  text: '#0f172a',             // Dark slate text
  textMuted: '#64748b',        // Cool grey text
  border: '#e2e8f0',           // Light border
  success: '#00c885',          // Clean Mint Green success
  danger: '#ef4444',           // Classic rich warning red
  adminBg: '#00AEFF',          // Primary blue highlight for admin
  adminSidebar: '#1e293b',     // Slate sidebar
  
  // Premium UI Status Pill Colors (Consistent light highlights)
  warning: '#16a34a',          // Solid rich green
  info: '#0284c7',             // Rich blue info
  purple: '#7c3aed',           // Classic purple
  gray: '#64748b',             // Slate gray
  lightGreen: '#dcfce7',       // Pastel green
  lightRed: '#fee2e2',         // Pastel red
  lightWarning: '#f0fdf4',     // Pastel warning
  lightInfo: '#e0f2fe',        // Pastel blue
  lightPurple: '#f3e8ff',      // Pastel purple
};

// Global active theme name tracker
let globalActiveTheme = 'dark';

export function getActiveThemeName() {
  return globalActiveTheme;
}

export function setActiveThemeName(name) {
  globalActiveTheme = name || 'dark';
}

// Export colors as a dynamic Proxy
export const colors = new Proxy({}, {
  get(target, prop) {
    const activeTheme = getActiveThemeName();
    const activeColors = activeTheme === 'dark' ? darkTheme : lightTheme;
    return activeColors[prop] || darkTheme[prop];
  }
});

// Monkey-patch StyleSheet.create globally
const originalCreate = StyleSheet.create;

StyleSheet.create = (styles) => {
  return new Proxy(styles, {
    get(target, prop) {
      if (prop in target) {
        const rawStyle = target[prop];
        if (typeof rawStyle === 'object' && rawStyle !== null) {
          const activeTheme = getActiveThemeName();
          if (activeTheme === 'dark') {
            return rawStyle;
          }
          
          // Map dark color values to light color values dynamically
          const resolved = {};
          for (const key of Object.keys(rawStyle)) {
            const val = rawStyle[key];
            if (typeof val === 'string') {
              let mapped = val;
              for (const colorKey of Object.keys(darkTheme)) {
                if (darkTheme[colorKey] === val) {
                  mapped = lightTheme[colorKey];
                  break;
                }
              }
              resolved[key] = mapped;
            } else {
              resolved[key] = val;
            }
          }
          return resolved;
        }
        return rawStyle;
      }
      return undefined;
    }
  });
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 6,
  },
};
