/**
 * Deterministic team color palette generator.
 * Assigns a unique, vibrant HSL color to each team based on its name hash.
 * Used for scoring tabs, points table rows, hero gradients, and match cards.
 */

const COLOR_PALETTES = [
  { primary: "#1a73e8", light: "#e8f0fe", dark: "#174ea6", name: "Royal Blue" },
  { primary: "#e8b20c", light: "#fef7e0", dark: "#b58900", name: "Gold" },
  { primary: "#d32f2f", light: "#fde8e8", dark: "#b71c1c", name: "Crimson" },
  { primary: "#7b1fa2", light: "#f3e5f5", dark: "#4a148c", name: "Purple" },
  { primary: "#e65100", light: "#fff3e0", dark: "#bf360c", name: "Orange" },
  { primary: "#00897b", light: "#e0f2f1", dark: "#004d40", name: "Teal" },
  { primary: "#c2185b", light: "#fce4ec", dark: "#880e4f", name: "Pink" },
  { primary: "#0288d1", light: "#e1f5fe", dark: "#01579b", name: "Sky Blue" },
  { primary: "#2e7d32", light: "#e8f5e9", dark: "#1b5e20", name: "Green" },
  { primary: "#f9a825", light: "#fffde7", dark: "#f57f17", name: "Sunflower" },
  { primary: "#5c6bc0", light: "#e8eaf6", dark: "#283593", name: "Indigo" },
  { primary: "#ef6c00", light: "#fff3e0", dark: "#e65100", name: "Amber" },
  { primary: "#00acc1", light: "#e0f7fa", dark: "#006064", name: "Cyan" },
  { primary: "#ad1457", light: "#fce4ec", dark: "#880e4f", name: "Magenta" },
  { primary: "#558b2f", light: "#f1f8e9", dark: "#33691e", name: "Olive" },
  { primary: "#6a1b9a", light: "#f3e5f5", dark: "#4a148c", name: "Violet" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export interface TeamColor {
  primary: string;
  light: string;
  dark: string;
  name: string;
}

/**
 * Get a deterministic color palette for a team.
 * Same team name always returns the same color.
 */
export function getTeamColor(teamName: string): TeamColor {
  if (!teamName) return COLOR_PALETTES[0];
  const index = hashString(teamName.toLowerCase().trim()) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

/**
 * Get team color as CSS custom properties string for inline styles.
 */
export function teamColorStyle(teamName: string): React.CSSProperties {
  const c = getTeamColor(teamName);
  return {
    "--team-primary": c.primary,
    "--team-light": c.light,
    "--team-dark": c.dark,
  } as React.CSSProperties;
}
