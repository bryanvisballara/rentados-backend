const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const deployRoutes = require('./deploy');
const residentRoutes = require('./resident');
const porteriaRoutes = require('./porteria');

const platformRoutes = require('./platform');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/platform', platformRoutes);
router.use('/admin', adminRoutes);
router.use('/deploy', deployRoutes);
router.use('/resident', residentRoutes);
router.use('/porteria', porteriaRoutes);

module.exports = router;
