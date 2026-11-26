/** One drawn icon set: 24px grid, 1.75 stroke, round joins. Decorative: the meaning is always carried by a word. */
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
  box: 'M12 3 4 7v10l8 4 8-4V7l-8-4ZM4 7l8 4m0 0 8-4M12 11v10',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5L13 16l3-3 4 4M9 9.5h.01',
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  store: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v1.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0V9M5.5 13v7h13v-7M10 20v-4h4v4',
  shield: 'M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6l-7-3ZM9 12l2.2 2.2L15 10.5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  alert: 'M12 3.5 21 19.5H3L12 3.5ZM12 10v4.5M12 17.2h.01',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  x: 'M6 6l12 12M18 6 6 18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
