import type { Technique } from '../types';
import { claiming, pointing } from './intersections';
import { jellyfish, swordfish, xWing } from './fish';
import { hiddenSingle, nakedSingle } from './singles';
import { hiddenPair, hiddenTriple, nakedPair, nakedQuad, nakedTriple } from './subsets';
import { trial } from './trial';
import { xyWing, xyzWing } from './wings';

/** Ordered from easiest to hardest — the solver always uses the first that applies. */
export const TECHNIQUES: Technique[] = [
  hiddenSingle,
  nakedSingle,
  pointing,
  claiming,
  nakedPair,
  hiddenPair,
  nakedTriple,
  hiddenTriple,
  xWing,
  xyWing,
  nakedQuad,
  swordfish,
  xyzWing,
  jellyfish,
  trial,
];

export const TECHNIQUE_BY_ID = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<
  Technique['id'],
  Technique
>;
