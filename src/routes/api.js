const express = require('express');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const deployRoutes = require('./deploy');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/deploy', deployRoutes);

module.exports = router;
