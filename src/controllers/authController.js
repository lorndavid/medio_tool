const Joi = require('joi');
const Admin = require('../models/Admin');
const { sign } = require('../middleware/auth');
const { ValidationError, AuthError } = require('../utils/errors');

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().min(6).required(),
});

async function loginPage(req, res) {
  res.render('admin/login', { error: null });
}

async function login(req, res) {
  const { value, error } = loginSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    return res.status(400).render('admin/login', { error: error.message, csrfToken: req.csrfToken(), layout: false });
  }
  const admin = await Admin.findOne({ email: value.email.toLowerCase() });
  if (!admin || !admin.isActive) {
    return res.status(401).render('admin/login', { error: 'Invalid credentials', csrfToken: req.csrfToken(), layout: false });
  }
  const ok = await admin.verifyPassword(value.password);
  if (!ok) {
    return res.status(401).render('admin/login', { error: 'Invalid credentials', csrfToken: req.csrfToken(), layout: false });
  }
  admin.lastLoginAt = new Date();
  await admin.save();
  const token = sign(admin);
  res.cookie('mf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.redirect('/admin');
}

async function logout(req, res) {
  res.clearCookie('mf_token');
  res.redirect('/admin/login');
}

module.exports = { loginPage, login, logout };
