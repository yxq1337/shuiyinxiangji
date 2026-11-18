/*!
 * Gallery Heading — ThreeUI Community
 * Source: https://threeui.com/component/gallery-heading
 * MIT License (c) Meng To / Design+Code
 *
 * Four gallery variants. Each owns its field (palette + noise), typography,
 * and orbit direction.
 */

export type GalleryVariant =
  | 'rising-diagonal'
  | 'falling-diagonal'
  | 'horizontal-sweep'
  | 'vertical-loop';

export interface GalleryConfig {
  label: string;
  /** screen angle of the ring's major axis (deg) */
  axisDeg: number;
  /** orbit direction: +1 / -1 */
  spin: 1 | -1;
  /** psi of tile 0 at t = 0 (deg) */
  phaseDeg: number;
  /** seconds for one full revolution */
  revolveSeconds: number;
  /** page background */
  background: string;
  /** twelve flat plate colours */
  palette: string[];
  /** procedural noise field: frequency + contrast */
  noiseScale: number;
  noiseContrast: number;
  /** typography */
  fontFamily: string;
  fontWeight: number;
  lines: [string, string];
  textColor: string;
  dimColor: string;
}

const SANS = '"Helvetica Neue", Helvetica, Inter, "Segoe UI", Arial, system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Songti SC", serif';
const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

export const VARIANTS: Record<GalleryVariant, GalleryConfig> = {
  'rising-diagonal': {
    label: 'Rising Diagonal',
    axisDeg: 25.5,
    spin: 1,
    phaseDeg: 93,
    revolveSeconds: 15,
    background: '#000000',
    palette: [
      '#d94b3d', '#e9b44c', '#1f7a8c', '#f2e9e4', '#5b2a86', '#d64933',
      '#2ec4b6', '#ffbe0b', '#3a0ca3', '#f72585', '#4361ee', '#8ac926',
    ],
    noiseScale: 3.4,
    noiseContrast: 0.85,
    fontFamily: SANS,
    fontWeight: 700,
    lines: ['NEW GRAINIENT', 'COLLECTION ADDED'],
    textColor: '#ffffff',
    dimColor: '#d0d0d0',
  },
  'falling-diagonal': {
    label: 'Falling Diagonal',
    axisDeg: -25.5,
    spin: -1,
    phaseDeg: 33,
    revolveSeconds: 18,
    background: '#030604',
    palette: [
      '#0f5132', '#95d5b2', '#d8f3dc', '#f2e8cf', '#bc4749', '#1b4332',
      '#52b788', '#e9c46a', '#2a9d8f', '#264653', '#e76f51', '#a3b18a',
    ],
    noiseScale: 2.6,
    noiseContrast: 0.7,
    fontFamily: SERIF,
    fontWeight: 700,
    lines: ['FORM STUDY', 'VOL. 04'],
    textColor: '#f4f1e8',
    dimColor: '#c9c4b4',
  },
  'horizontal-sweep': {
    label: 'Horizontal Sweep',
    axisDeg: 0,
    spin: 1,
    phaseDeg: 0,
    revolveSeconds: 12,
    background: '#050505',
    palette: [
      '#e0d8c8', '#c2452d', '#1d3557', '#f1faee', '#a8dadc', '#e9c46a',
      '#264653', '#e76f51', '#2b2d42', '#8d99ae', '#edf2f4', '#d90429',
    ],
    noiseScale: 4.2,
    noiseContrast: 1.0,
    fontFamily: MONO,
    fontWeight: 700,
    lines: ['GALLERY', 'HEADING'],
    textColor: '#ffffff',
    dimColor: '#b9b9b9',
  },
  'vertical-loop': {
    label: 'Vertical Loop',
    axisDeg: 90,
    spin: -1,
    phaseDeg: 180,
    revolveSeconds: 20,
    background: '#040208',
    palette: [
      '#2d1b69', '#7b2cbf', '#c77dff', '#e0aaff', '#240046', '#5a189a',
      '#9d4edd', '#ff9e00', '#3c096c', '#ff6d00', '#10002b', '#e0aaff',
    ],
    noiseScale: 3.0,
    noiseContrast: 0.75,
    fontFamily: SANS,
    fontWeight: 800,
    lines: ['MOTION PLATES', 'TWELVE'],
    textColor: '#f2ecff',
    dimColor: '#b9a8d8',
  },
};
