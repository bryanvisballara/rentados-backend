export function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function IconBuilding(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </svg>
  );
}

export function IconGrid(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M16 11a3 3 0 1 0-6 0" />
      <path d="M8 14a4 4 0 0 0-4 4v1h8" />
      <path d="M16 14h4a4 4 0 0 0-4-4" />
      <circle cx="10" cy="8" r="3" />
    </svg>
  );
}

export function IconBag(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 8h12l-1 13H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function IconUtensils(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M8 4v8M6 4v5M10 4v5" />
      <path d="M8 12v8" />
      <path d="M16 4v16" />
    </svg>
  );
}

export function IconPackage(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z" />
      <path d="M12 12 21 8M12 12 3 8M12 12v9" />
    </svg>
  );
}

export function IconCar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 17h14l-1-7H6l-1 7Z" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  );
}

export function IconHeadset(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 12a8 8 0 0 1 16 0" />
      <rect x="3" y="12" width="4" height="7" rx="1.5" />
      <rect x="17" y="12" width="4" height="7" rx="1.5" />
    </svg>
  );
}

export function IconBriefcase(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function IconHeart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 7 2a4 4 0 0 1-7 10Z" />
    </svg>
  );
}

export function IconChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function facilityIconName(icon) {
  const map = {
    dumbbell: 'Gimnasio',
    users: 'Eventos',
    flame: 'Sauna',
    droplets: 'Piscina',
    tree: 'Zonas verdes',
    sparkles: 'Spa',
  };
  return map[icon] || null;
}

export function FacilityGlyph({ icon, className }) {
  const glyphs = {
    dumbbell: '🏋️',
    users: '🎉',
    flame: '🔥',
    droplets: '💧',
    tree: '🌿',
    sparkles: '✨',
    bath: '🧖',
    calendar: '📅',
  };

  return <span className={className}>{glyphs[icon] || '🏢'}</span>;
}
