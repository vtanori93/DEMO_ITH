import type { CSSProperties } from 'react'
const paths = {
  pulse: 'M2 12h4l3-8 5 16 3-8h5',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  plug: 'M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5',
  code: 'm8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 22',
  arrow: 'M7 17 17 7M7 7h10v10',
  chevron: 'm9 5 7 7-7 7',
  download: 'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
  play: 'm8 5 11 7-11 7V5Z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M3 11a9 9 0 1 1 2 7M3 4v7h7',
  wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  layers: 'm12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  check: 'm5 12 4 4L19 6',
  info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  copy: 'M9 9h12v12H9zM15 9V3H3v12h6',
  chip: 'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  bolt: 'm13 2-9 12h7l-1 8L21 9h-8l1-7Z',
  close: 'm6 6 12 12M6 18 18 6',
  sidebarCollapse: 'M3 3h18v18H3zM8 3v18m8-13-4 4 4 4',
  sidebarExpand: 'M3 3h18v18H3zM8 3v18m4-13 4 4-4 4',
  sliders: 'M4 3v7m0 4v7M12 3v11m0 4v3M20 3v3m0 4v11M1 10h6m2 8h6m2-12h6',
  gauge: 'M4 18a9 9 0 1 1 16 0M12 13l4-5M7 17h10',
  ring: 'M21 12a9 9 0 1 1-9-9m0 3V2m3 3 3-3m0 7h4',
  bar: 'M3 8h18v8H3zM7 8v8m4-8v8',
  digits: 'M3 6h18v12H3zM7 10h2v4H7m5-4v4m4-4h2v4h-2',
} as const
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: keyof typeof paths
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  )
}
