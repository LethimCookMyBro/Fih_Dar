import type { SVGProps } from 'react';

/**
 * Original FihDar mark: a sonar/radar ring with a single tapered sweep blade that
 * reads simultaneously as a radar sweep and a fin — deliberately abstract rather
 * than a literal fish-inside-a-radar illustration. Two flat shapes, no gradients,
 * so it holds up in one color from favicon size up through hero size. Uses
 * currentColor throughout, so light/dark/mono variants are just the caller's
 * text color — no separate light/dark files needed.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 0 32 32' fill='none' aria-hidden {...props}>
      <circle cx='16' cy='16' r='11' stroke='currentColor' strokeWidth='2.25' />
      <path
        d='M16 16 C15.4 9.6 18.2 6.4 23.07 7.57 C20.3 9.7 18 12.6 16 16 Z'
        fill='currentColor'
      />
      <circle cx='16' cy='16' r='1.8' fill='currentColor' />
    </svg>
  );
}

export default LogoMark;
