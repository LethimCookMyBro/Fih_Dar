'use client';

// FihDar-original component (not React Bits): a looping label that flows along an SVG
// path via <textPath>, animated by GSAP nudging startOffset. Decorative by default —
// wrap usage in aria-hidden when the same text is already announced elsewhere.
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import gsap from 'gsap';

export type TextLoopShape = 'wave' | 'circle' | 'infinity' | 'arch' | 'line';

export type TextLoopProps = {
  text?: string;
  shape?: TextLoopShape;
  path?: string;
  speed?: number;
  direction?: 'forward' | 'reverse';
  separator?: string;
  curviness?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  color?: string;
  ribbon?: boolean;
  ribbonColor?: string;
  ribbonWidth?: number;
  ribbonOpacity?: number;
  pauseOnHover?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

// Fallback viewBox before the first real measurement (see `dims` below) — never
// what actually renders once mounted.
const DEFAULT_VIEW_W = 1000;
const DEFAULT_VIEW_H = 200;

function buildPath(shape: TextLoopShape, curviness: number, viewW: number, viewH: number): string {
  const c = Math.max(0, Math.min(100, curviness));
  const midY = viewH / 2;
  const amp = (c / 100) * (viewH / 2 - 10);

  switch (shape) {
    case 'line':
      return `M 0 ${midY} L ${viewW} ${midY}`;
    case 'wave':
      return `M 0 ${midY} C ${viewW * 0.25} ${midY - amp}, ${viewW * 0.25} ${midY - amp}, ${viewW * 0.5} ${midY} S ${viewW * 0.75} ${midY + amp}, ${viewW} ${midY}`;
    case 'arch':
      return `M 0 ${viewH - 10} Q ${viewW / 2} ${viewH - 10 - amp * 2}, ${viewW} ${viewH - 10}`;
    case 'circle': {
      const r = viewH / 2 - 10;
      const cx = viewW / 2;
      const cy = midY;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
    }
    case 'infinity': {
      const r = amp || 40;
      const cx1 = viewW * 0.3;
      const cx2 = viewW * 0.7;
      return `M ${cx1} ${midY} C ${cx1 - r} ${midY - r}, ${cx1 - r} ${midY + r}, ${cx1} ${midY} C ${cx1 + r * 1.5} ${midY - r * 1.5}, ${cx2 - r * 1.5} ${midY + r * 1.5}, ${cx2} ${midY} C ${cx2 + r} ${midY - r}, ${cx2 + r} ${midY + r}, ${cx2} ${midY} C ${cx2 - r * 1.5} ${midY - r * 1.5}, ${cx1 + r * 1.5} ${midY + r * 1.5}, ${cx1} ${midY} Z`;
    }
    default:
      return `M 0 ${midY} L ${viewW} ${midY}`;
  }
}

export function TextLoop({
  text = 'FIHDAR',
  shape = 'wave',
  path,
  speed = 24,
  direction = 'forward',
  separator = '•',
  curviness = 36,
  fontSize = 20,
  fontWeight = 600,
  letterSpacing = 1.5,
  uppercase = false,
  color = 'currentColor',
  ribbon = false,
  ribbonColor = 'currentColor',
  ribbonWidth = 1,
  ribbonOpacity = 1,
  pauseOnHover = false,
  className,
  style
}: TextLoopProps) {
  const uid = useId().replace(/[:]/g, '');
  const pathId = `text-loop-path-${uid}`;
  const textRef = useRef<SVGTextElement>(null);
  const textPathRef = useRef<SVGTextPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const reduceMotion = useReducedMotion();

  // The path/text/ribbon must fill this element's actual rendered box, not a fixed
  // 1000x200 abstraction — with the default `xMidYMid meet` viewBox scaling, any
  // container whose aspect ratio isn't 5:1 gets letterboxed, shrinking the visible
  // content well below what the wrapper's CSS size implies (the root cause behind
  // this component reading as "microscopic" no matter how the numeric props were
  // tuned). An explicit `path` prop assumes the default coordinate space instead.
  const [dims, setDims] = useState({ w: DEFAULT_VIEW_W, h: DEFAULT_VIEW_H });

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || path) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setDims({ w: rect.width, h: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [path]);

  const viewW = path ? DEFAULT_VIEW_W : dims.w;
  const viewH = path ? DEFAULT_VIEW_H : dims.h;
  const d = path ?? buildPath(shape, curviness, viewW, viewH);
  const displayText = uppercase ? text.toUpperCase() : text;
  const loopText = `${displayText} ${separator} `.repeat(3);

  useLayoutEffect(() => {
    const textPathEl = textPathRef.current;
    const pathEl = svgRef.current?.querySelector<SVGPathElement>(`#${pathId}`);
    if (!textPathEl || !pathEl) return;

    tweenRef.current?.kill();

    if (reduceMotion) {
      textPathEl.setAttribute('startOffset', '0');
      return;
    }

    const pathLength = pathEl.getTotalLength();
    const segmentLength = textPathEl.getComputedTextLength() / 3 || pathLength;
    const durationSeconds = segmentLength / Math.max(1, speed);
    const from = direction === 'reverse' ? -segmentLength : 0;
    const to = direction === 'reverse' ? 0 : -segmentLength;

    textPathEl.setAttribute('startOffset', String(from));
    tweenRef.current = gsap.to(textPathEl, {
      attr: { startOffset: to },
      duration: durationSeconds,
      ease: 'none',
      repeat: -1
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [d, speed, direction, loopText, pathId, reduceMotion]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${viewW} ${viewH}`}
      className={className}
      style={style}
      aria-hidden
      onMouseEnter={pauseOnHover ? () => tweenRef.current?.pause() : undefined}
      onMouseLeave={pauseOnHover ? () => tweenRef.current?.resume() : undefined}
    >
      <defs>
        <path id={pathId} d={d} fill='none' />
      </defs>
      {ribbon && (
        <use
          href={`#${pathId}`}
          stroke={ribbonColor}
          strokeWidth={ribbonWidth}
          fill='none'
          opacity={ribbonOpacity}
        />
      )}
      <text
        ref={textRef}
        fill={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        style={{ letterSpacing }}
      >
        <textPath ref={textPathRef} href={`#${pathId}`} startOffset='0'>
          {loopText}
        </textPath>
      </text>
    </svg>
  );
}

export default TextLoop;
