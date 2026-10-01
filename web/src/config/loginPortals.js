export const LOGIN_PORTALS = {
  resident: {
    id: 'resident',
    title: 'Bienvenido',
    subtitle: 'Avisos, reservas y pagos de tu hogar, en un solo lugar.',
    heroTagline: 'Tu conjunto, simplificado',
    submitLabel: 'Iniciar sesión',
    switchPrompt: '¿Acceso corporativo?',
    switchLinks: [{ label: 'Administración', to: '/admin/login' }],
  },
  admin: {
    id: 'admin',
    title: 'Panel de administración',
    subtitle: 'Gestiona unidades, residentes y servicios de tu conjunto.',
    heroTagline: 'Administra con claridad',
    submitLabel: 'Ingresar al panel',
    switchPrompt: '¿No eres administrador?',
    switchLinks: [
      { label: 'Portal de residentes', to: '/login' },
      { label: 'Super administración', to: '/super-admin/login' },
      { label: 'Portería', to: '/porteria/login' },
    ],
  },
  superadmin: {
    id: 'superadmin',
    title: 'Super administración',
    subtitle: 'Crea conjuntos residenciales, edificios y asigna administradores.',
    heroTagline: 'Plataforma Rentados',
    submitLabel: 'Ingresar',
    switchPrompt: '¿Buscas otro acceso?',
    switchLinks: [
      { label: 'Administración de conjunto', to: '/admin/login' },
      { label: 'Portal de residentes', to: '/login' },
    ],
  },
  porteria: {
    id: 'porteria',
    title: 'Portal de portería',
    subtitle: 'Control de accesos, visitantes y apoyo al conjunto.',
    heroTagline: 'Siempre atentos',
    submitLabel: 'Ingresar',
    switchPrompt: '¿Buscas otro acceso?',
    switchLinks: [
      { label: 'Portal de residentes', to: '/login' },
      { label: 'Administración', to: '/admin/login' },
    ],
  },
};
