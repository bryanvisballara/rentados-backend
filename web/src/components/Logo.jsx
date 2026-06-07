import { useState } from 'react';
import './Logo.css';

const LOGO_SOURCES = ['/assets/logo.png', '/assets/logo.svg'];

export default function Logo({ size = 'md' }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  if (showPlaceholder || sourceIndex >= LOGO_SOURCES.length) {
    return (
      <div className={`logo-placeholder logo-placeholder--${size}`} aria-label="Espacio reservado para logo">
        <span className="logo-placeholder__mark">R</span>
        <span className="logo-placeholder__hint">Tu logo aquí</span>
      </div>
    );
  }

  return (
    <img
      className={`logo logo--${size}`}
      src={LOGO_SOURCES[sourceIndex]}
      alt="Rentados"
      onError={() => {
        if (sourceIndex < LOGO_SOURCES.length - 1) {
          setSourceIndex((i) => i + 1);
        } else {
          setShowPlaceholder(true);
        }
      }}
    />
  );
}
