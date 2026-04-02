const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000003';
const DEFAULT_ROLE = process.env.DEFAULT_ROLE || 'manager';
const DEFAULT_CENTER_ID = process.env.DEFAULT_CENTER_ID || '11111111-1111-1111-1111-111111111111';

const allowedRoles = new Set(['platform_owner', 'center_owner', 'manager']);

export function authContextMiddleware(req, _res, next) {
  const headerUserId = req.header('x-user-id');
  const headerRole = req.header('x-role');
  const headerCenterId = req.header('x-center-id');

  const role = allowedRoles.has(headerRole) ? headerRole : DEFAULT_ROLE;
  const userId = headerUserId || DEFAULT_USER_ID;
  const centerId = role === 'platform_owner' ? (headerCenterId || null) : (headerCenterId || DEFAULT_CENTER_ID);

  req.authContext = {
    userId,
    role,
    centerId,
  };

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const { role } = req.authContext || {};
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    return next();
  };
}

export function requireCenterAccess(paramName = 'centerId') {
  return (req, res, next) => {
    const { role, centerId } = req.authContext || {};
    const routeCenterId = req.params[paramName];

    if (!routeCenterId) {
      return res.status(400).json({ error: 'centerId обязателен' });
    }

    if (role !== 'platform_owner' && centerId !== routeCenterId) {
      return res.status(403).json({ error: 'Доступ к этому центру запрещен' });
    }

    return next();
  };
}
