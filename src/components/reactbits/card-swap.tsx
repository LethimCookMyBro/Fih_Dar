'use client';

// Source: React Bits (@react-bits/CardSwap-TS-TW), https://reactbits.dev/components/card-swap
// Vendored from the free registry JSON (https://reactbits.dev/r/CardSwap-TS-TW.json).
// Adapted: the demo positions itself with `absolute bottom-0 right-0` assuming it owns a
// full hero — that escapes any bounded section. Positioning is now the caller's job (via
// `className`/`style` on the container this renders into); this component only sizes and
// animates the stack. Animation is skipped entirely under prefers-reduced-motion.
import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react';
import gsap from 'gsap';

export interface CardSwapProps {
  width?: number | string;
  height?: number | string;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  /**
   * When true the auto-rotate interval is stopped and any in-flight swap
   * timeline is paused (e.g. the section scrolled out of view). Resume by
   * flipping back to false — the rotation continues from where it paused.
   * Reduced motion still wins over both states.
   */
  paused?: boolean;
  onCardClick?: (idx: number) => void;
  skewAmount?: number;
  easing?: 'linear' | 'elastic';
  className?: string;
  children: ReactNode;
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest}
    className={`bg-card border-border absolute top-1/2 left-1/2 overflow-hidden rounded-xl border shadow-lg [backface-visibility:hidden] [transform-style:preserve-3d] [will-change:transform] ${customClass ?? ''} ${rest.className ?? ''}`.trim()}
  />
));
Card.displayName = 'Card';

type CardRef = RefObject<HTMLDivElement | null>;
interface Slot {
  x: number;
  y: number;
  z: number;
  zIndex: number;
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i
});

const placeNow = (el: HTMLElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true
  });

export default function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 50,
  verticalDistance = 55,
  delay = 5000,
  pauseOnHover = true,
  paused = false,
  onCardClick,
  skewAmount = 4,
  easing = 'elastic',
  className = '',
  children
}: CardSwapProps) {
  const config = useMemo(
    () =>
      easing === 'elastic'
        ? {
            ease: 'elastic.out(0.6,0.9)',
            durDrop: 2,
            durMove: 2,
            durReturn: 2,
            promoteOverlap: 0.9,
            returnDelay: 0.05
          }
        : {
            ease: 'power1.inOut',
            durDrop: 0.8,
            durMove: 0.8,
            durReturn: 0.8,
            promoteOverlap: 0.45,
            returnDelay: 0.2
          },
    [easing]
  );

  const childArr = useMemo(
    () => Children.toArray(children) as ReactElement<CardProps>[],
    [children]
  );
  const refs = useMemo<CardRef[]>(
    () => childArr.map(() => React.createRef<HTMLDivElement>()),
    [childArr]
  );
  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i));
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const intervalRef = useRef<number>(0);
  const container = useRef<HTMLDivElement>(null);
  const swapRef = useRef<() => void>(() => {});
  const [hoverPaused, setHoverPaused] = useState(false);

  // Hover pause is a real pause of the in-flight timeline; the visibility
  // `paused` prop pauses the auto-rotate but leaves the current frame intact.
  // Reduced motion wins over everything (checked in both effects below).
  const effectivelyPaused = paused || hoverPaused;

  // One-time setup: place the cards, define the swap, attach hover listeners.
  useEffect(() => {
    const total = refs.length;
    if (total === 0) return;
    refs.forEach(
      (r, i) =>
        r.current &&
        placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount)
    );

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const swap = () => {
      if (order.current.length < 2) return;
      const [front, ...rest] = order.current;
      const elFront = refs[front].current;
      if (!elFront) return;
      const tl = gsap.timeline();
      tlRef.current = tl;

      tl.to(elFront, { y: '+=500', duration: config.durDrop, ease: config.ease });
      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = refs[idx].current;
        if (!el) return;
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length);
        tl.set(el, { zIndex: slot.zIndex }, 'promote');
        tl.to(
          el,
          { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
          `promote+=${i * 0.15}`
        );
      });

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
      tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, 'return');
      tl.to(
        elFront,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: config.durReturn,
          ease: config.ease
        },
        'return'
      );
      tl.call(() => {
        order.current = [...rest, front];
      });
    };
    swapRef.current = swap;

    // Advance once on mount so the stack is mid-motion immediately, matching
    // the stock component's first-paint behaviour.
    swap();

    const node = container.current;
    if (!pauseOnHover || !node) return;
    const pause = () => {
      tlRef.current?.pause();
      setHoverPaused(true);
    };
    const resume = () => {
      tlRef.current?.play();
      setHoverPaused(false);
    };
    node.addEventListener('mouseenter', pause);
    node.addEventListener('mouseleave', resume);
    return () => {
      node.removeEventListener('mouseenter', pause);
      node.removeEventListener('mouseleave', resume);
    };
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs, config]);

  // Auto-rotate interval — the single owner of the timer, so the visibility
  // pause and the hover pause cannot fight over it. Runs only while the swap
  // is actually wanted (not paused, not reduced motion).
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    if (effectivelyPaused) {
      tlRef.current?.pause();
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
      return;
    }

    // Resume an in-flight timeline (visibility scroll-back or mouse leave).
    tlRef.current?.play();
    if (intervalRef.current === 0) {
      intervalRef.current = window.setInterval(() => swapRef.current(), delay);
    }
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = 0;
    };
  }, [effectivelyPaused, delay]);

  const rendered = childArr.map((child, i) =>
    isValidElement<CardProps>(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...child.props.style },
          onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            child.props.onClick?.(e);
            onCardClick?.(i);
          }
        } as CardProps & React.RefAttributes<HTMLDivElement>)
      : child
  );

  return (
    <div
      ref={container}
      className={`relative [perspective:900px] ${className}`}
      style={{ width, height }}
    >
      {rendered}
    </div>
  );
}
