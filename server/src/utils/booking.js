function createPnr() {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BB${Date.now().toString(36).toUpperCase()}${randomPart}`;
}

function getRefundAmount(totalFare) {
  const envPercent = Number(process.env.CANCELLATION_REFUND_PERCENT);
  const refundPercent = Number.isFinite(envPercent) ? Math.min(100, Math.max(0, envPercent)) : 80;
  return Math.round((Number(totalFare || 0) * refundPercent) / 100);
}

function normalizeDate(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

module.exports = { createPnr, getRefundAmount, normalizeDate };

