const express = require('express');
const csurf = require('csurf');
const { authRequired } = require('../middleware/auth');
const asyncH = require('../utils/asyncHandler');
const auth = require('../controllers/authController');
const dash = require('../controllers/dashboardController');
const userCtrl = require('../controllers/userController');
const broadcastCtrl = require('../controllers/broadcastController');

const router = express.Router();
// csurf with cookie-stored secret (no server session needed)
const csrfProtection = csurf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
});

// public — login renders without the admin layout
router.get('/login', csrfProtection, (req, res) =>
  res.render('admin/login', { error: null, csrfToken: req.csrfToken(), layout: false })
);
router.post('/login', csrfProtection, asyncH(auth.login));
router.post('/logout', csrfProtection, authRequired, asyncH(auth.logout));

// protected
router.use(authRequired);
router.use(csrfProtection);
router.use((req, res, next) => { res.locals.csrfToken = req.csrfToken(); next(); });

router.get('/', asyncH(dash.overview));
router.get('/users', asyncH(dash.users));
router.post('/users/:id/ban', asyncH(userCtrl.ban));
router.post('/users/:id/unban', asyncH(userCtrl.unban));
router.post('/users/:id/mute', asyncH(userCtrl.mute));
router.post('/users/:id/unmute', asyncH(userCtrl.unmute));
router.get('/users/export.csv', asyncH(userCtrl.exportCsv));

router.get('/analytics', asyncH(dash.analyticsPage));
router.get('/media', asyncH(dash.mediaActivity));
router.get('/logs', asyncH(dash.logsPage));

router.get('/settings', asyncH(dash.settingsPage));
router.post('/settings', asyncH(dash.settingsUpdate));

router.get('/languages', asyncH(dash.languagesPage));
router.get('/themes', asyncH(dash.themesPage));
router.get('/api-settings', asyncH(dash.apiSettingsPage));
router.get('/performance', asyncH(dash.performancePage));

router.get('/broadcast', asyncH(dash.broadcastPage));
router.post('/broadcast', asyncH(broadcastCtrl.send));

router.get('/support', asyncH(dash.supportPage));

module.exports = router;
