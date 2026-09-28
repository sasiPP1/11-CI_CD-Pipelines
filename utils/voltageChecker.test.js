'use strict';

const { checkVoltage } = require('./voltageChecker');

describe('checkVoltage', () => {
  test('returns CRITICAL when voltage is 260', () => {
    expect(checkVoltage(260)).toBe('CRITICAL');
  });

  test('returns NORMAL when voltage is 230', () => {
    expect(checkVoltage(230)).toBe('NORMAL');
  });

  test('returns LOW when voltage is 200', () => {
    expect(checkVoltage(200)).toBe('LOW');
  });

  test('returns NORMAL at the 250 boundary', () => {
    expect(checkVoltage(250)).toBe('NORMAL');
  });

  test('returns NORMAL at the 220 boundary', () => {
    expect(checkVoltage(220)).toBe('NORMAL');
  });

  test('returns CRITICAL just above 250 (251)', () => {
    expect(checkVoltage(251)).toBe('CRITICAL');
  });

  test('returns LOW just below 220 (219)', () => {
    expect(checkVoltage(219)).toBe('LOW');
  });

  test('throws TypeError for non-number input', () => {
    expect(() => checkVoltage('220')).toThrow(TypeError);
    expect(() => checkVoltage('220')).toThrow('voltage must be a finite number');
  });

  test('throws TypeError for NaN and Infinity', () => {
    expect(() => checkVoltage(NaN)).toThrow(TypeError);
    expect(() => checkVoltage(Infinity)).toThrow(TypeError);
  });
});
