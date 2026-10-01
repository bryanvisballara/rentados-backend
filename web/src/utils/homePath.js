export function homePathForUser(user) {
  switch (user?.role) {
    case 'RESIDENT':
      return '/app';
    case 'ORG_ADMIN':
      return '/admin';
    case 'SUPER_ADMIN':
      return '/super-admin';
    case 'ORG_STAFF':
      return '/porteria';
    default:
      return '/login';
  }
}
