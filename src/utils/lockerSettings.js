function getLockerSettings(org) {
  const locker = org?.settings?.locker || {};
  return {
    enabled: locker.enabled ?? false,
    receiveWhenOverdue: locker.receiveWhenOverdue ?? true,
    notifyWhenOverdue: locker.notifyWhenOverdue ?? true,
  };
}

module.exports = { getLockerSettings };
