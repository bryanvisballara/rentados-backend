const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const deployRoutes = require('./deploy');
const residentRoutes = require('./resident');

const platformRoutes = require('./platform');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/platform', platformRoutes);
router.use('/admin', adminRoutes);
router.use('/deploy', deployRoutes);
router.use('/resident', residentRoutes);

module.exports = router;
