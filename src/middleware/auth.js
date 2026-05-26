const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Admin = require('../models/Admin');
const { AuthError, ForbiddenError } = require('../utils/errors');

function sign(admin) {
  return jwt.sign(
    { sub: admin._id.toString(), role: admin.role, name: admin.name },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function authRequired(req, res, next) {
  const token = req.cookies?.mf_token;
  if (!token) {
    if (req.accepts('html')) return res.redirect('/admin/login');
    return next(new AuthError());
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.adminId = payload.sub;
    req.adminRole = payload.role;
    req.adminName = payload.name;
    return next();
  } catch (e) {
    res.clearCookie('mf_token');
    if (req.accepts('html')) return res.redirect('/admin/login');
    return next(new AuthError('Invalid session'));
  }
}

function requirePerm(perm) {
  return async (req, res, next) => {
    try {
      const admin = await Admin.findById(req.adminId).lean();
      if (!admin || !admin.isActive) throw new AuthError();
      if (admin.role === 'superadmin') return next();
      if (perm && admin.permissions?.[perm]) return next();
      throw new ForbiddenError();
    } catch (e) { next(e); }
  };
}

module.exports = { sign, authRequired, requirePerm };
