'use strict';

/**
 * Classify a measured voltage into a status bucket.
 *
 * @param {number} voltage measured voltage in volts
 * @returns {'CRITICAL'|'NORMAL'|'LOW'} status for the reading
 * @throws {TypeError} when voltage is not a finite number
 */
function checkVoltage(voltage) {
  if (!Number.isFinite(voltage)) {
    throw new TypeError('voltage must be a finite number');
  }
  if (voltage > 250) {
    return 'CRITICAL';
  }
  if (voltage >= 220) {
    return 'NORMAL';
  }
  return 'LOW';
}

module.exports = { checkVoltage };
