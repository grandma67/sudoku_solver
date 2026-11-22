import type { SVGProps } from 'react';

const make = (path: string, filled = false) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };

export const IconUndo = make('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11');
export const IconRedo = make('m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13');
export const IconErase = make('M20 20H8l-4-4 10-10 6 6-7 7M18 13l-6-6');
export const IconPencil = make('M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z');
export const IconWand = make('m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM5 21l11-11M19 13l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5Z');
export const IconBulb = make('M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z');
export const IconPlay = make('M7 4v16l13-8Z', true);
export const IconPause = make('M6 4h4v16H6zM14 4h4v16h-4z', true);
export const IconPrev = make('m15 18-6-6 6-6');
export const IconNext = make('m9 18 6-6-6-6');
export const IconFirst = make('m17 18-6-6 6-6M7 6v12');
export const IconLast = make('m7 18 6-6-6-6M17 6v12');
export const IconGear = make(
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
);
export const IconShare = make('M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14');
export const IconPlus = make('M12 5v14M5 12h14');
export const IconEdit = make('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 17.5h7M17.5 14v7');
export const IconClose = make('M18 6 6 18M6 6l12 12');
export const IconBrain = make(
  'M9.5 2A2.5 2.5 0 0 0 7 4.5v.2A3 3 0 0 0 4.6 9 3 3 0 0 0 5 14.8 3 3 0 0 0 9 19.5a2.5 2.5 0 0 0 3 2.4V3.9A2.5 2.5 0 0 0 9.5 2ZM14.5 2A2.5 2.5 0 0 1 17 4.5v.2A3 3 0 0 1 19.4 9a3 3 0 0 1-.4 5.8 3 3 0 0 1-4 4.7 2.5 2.5 0 0 1-3 2.4',
);
export const IconRestart = make('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5');
export const IconClock = make('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2');
export const IconCheck = make('M20 6 9 17l-5-5');
export const IconCamera = make('M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z');
export const IconImage = make('M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 15l-5-5L5 21');
