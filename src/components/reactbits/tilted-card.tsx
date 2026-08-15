'use client';

// Source: React Bits (@react-bits/TiltedCard-TS-TW), https://reactbits.dev/components/tilted-card
// Vendored from the free registry JSON (https://reactbits.dev/r/TiltedCard-TS-TW.json).
// Adapted: FihDar-scale defaults (subtle tilt, not the demo's 14deg novelty amplitude),
// mobile warning and tooltip dropped, and tilt is fully disabled under
// prefers-reduced-motion and on touch/mobile rather than merely toned down.
import type { SpringOptions } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';

interface TiltedCardProps {
  imageSrc: React.ComponentProps<'img'>['src'];
  altText?: string;
  containerHeight?: React.CSSProperties['height'];
  containerWidth?: React.CSSProperties['width'];
  imageHeight?: React.CSSProperties['height'];
  imageWidth?: React.CSSProperties['width'];
  scaleOnHover?: number;
  rotateAmplitude?: number;
  overlayContent?: React.ReactNode;
  displayOverlayContent?: boolean;
  className?: string;
}

const springValues: SpringOptions = { damping: 30, stiffness: 100, mass: 2 };

export default function TiltedCard({
  imageSrc,
  altText = '',
  containerHeight = '300px',
  containerWidth = '100%',
  imageHeight = '300px',
  imageWidth = '100%',
  scaleOnHover = 1.02,
  rotateAmplitude = 6,
  overlayContent = null,
  displayOverlayContent = false,
  className = ''
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const reduceMotion = useReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFinePointer(pointerQuery.matches);
    update();
    pointerQuery.addEventListener('change', update);
    return () => pointerQuery.removeEventListener('change', update);
  }, []);

  const tiltEnabled = !reduceMotion && finePointer;

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    if (!tiltEnabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);
  }

  function handleMouseEnter() {
    if (!tiltEnabled) return;
    scale.set(scaleOnHover);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      ref={ref}
      className={`relative flex h-full w-full flex-col items-center justify-center [perspective:800px] ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className='relative [transform-style:preserve-3d]'
        style={{ width: imageWidth, height: imageHeight, rotateX, rotateY, scale }}
      >
        <motion.img
          src={imageSrc}
          alt={altText}
          className='absolute top-0 left-0 h-full w-full rounded-xl object-cover will-change-transform [transform:translateZ(0)]'
        />
        {displayOverlayContent && overlayContent && (
          <div className='absolute top-0 left-0 z-[2] h-full w-full will-change-transform [transform:translateZ(30px)]'>
            {overlayContent}
          </div>
        )}
      </motion.div>
    </div>
  );
}
