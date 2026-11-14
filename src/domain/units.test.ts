import { describe, expect, it } from 'vitest';

import {
  CANONICAL_UNIT,
  DISPLAY_PRECISION,
  DISPLAY_UNIT,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  formatBloodPressure,
  formatGlucose,
  formatHoursMinutes,
  formatMass,
  formatNumber,
  formatSignalValue,
  formatTemperature,
  kgToLb,
  lbToKg,
  mgdlToMmoll,
  missionDayWindow,
  missionDaysBetween,
  mmollToMgdl,
  roundTo,
} from './units';

describe('conversions', () => {
  it('°C ↔ °F', () => {
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 10);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 10);
    expect(fahrenheitToCelsius(celsiusToFahrenheit(36.6))).toBeCloseTo(36.6, 10);
  });
  it('mg/dL ↔ mmol/L uses ÷ 18.016', () => {
    expect(mgdlToMmoll(90.08)).toBeCloseTo(5, 10);
    expect(mmollToMgdl(5)).toBeCloseTo(90.08, 10);
    expect(mmollToMgdl(mgdlToMmoll(126))).toBeCloseTo(126, 10);
  });
  it('kg ↔ lb', () => {
    expect(lbToKg(1)).toBe(0.45359237);
    expect(kgToLb(0.45359237)).toBeCloseTo(1, 12);
    expect(kgToLb(lbToKg(180))).toBeCloseTo(180, 10);
  });
});

describe('roundTo', () => {
  it('rounds half away from zero without binary artefacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(36.95, 1)).toBe(37);
    expect(roundTo(39.5, 0)).toBe(40);
    expect(roundTo(39.4999, 0)).toBe(39);
    expect(roundTo(-0.05, 1)).toBe(-0.1);
    expect(roundTo(-0.04, 1)).toBe(0);
    expect(roundTo(4.5, 0)).toBe(5);
  });
  it('handles exponential notation and non-finite input', () => {
    expect(roundTo(1e-7, 2)).toBe(0);
    expect(roundTo(1.23e21, 0)).toBe(1.23e21);
    expect(roundTo(Number.NaN, 1)).toBeNaN();
    expect(roundTo(Number.POSITIVE_INFINITY, 1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('formatting', () => {
  it('formatNumber pads decimals', () => {
    expect(formatNumber(7, 1)).toBe('7.0');
    expect(formatNumber(6.25, 1)).toBe('6.3');
  });
  it('formatSignalValue uses display precision and unit', () => {
    expect(formatSignalValue('heart_rate_rest', 58.4)).toBe('58 bpm');
    expect(formatSignalValue('body_temp', 36.66)).toBe('36.7 °C');
    expect(formatSignalValue('spo2', 97)).toBe('97%');
    expect(formatSignalValue('mood', 3)).toBe('3.0/5');
    expect(formatSignalValue('face_fluid_index', 1.034)).toBe('1.03');
    expect(formatSignalValue('cabin_co2', 3.44)).toBe('3.4 mmHg');
  });
  it('special formatters', () => {
    expect(formatBloodPressure(118.4, 76.6)).toBe('118/77 mmHg');
    expect(formatHoursMinutes(6.2)).toBe('6:12');
    expect(formatHoursMinutes(7)).toBe('7:00');
    expect(formatTemperature(37)).toBe('37.0 °C');
    expect(formatTemperature(37, 'F')).toBe('98.6 °F');
    expect(formatGlucose(126)).toBe('126 mg/dL');
    expect(formatGlucose(126, 'mmol/L')).toBe('7.0 mmol/L');
    expect(formatMass(82)).toBe('82.0 kg');
    expect(formatMass(82, 'lb')).toBe('180.8 lb');
  });
  it('tables cover every signal', () => {
    const ids = Object.keys(CANONICAL_UNIT).sort();
    expect(Object.keys(DISPLAY_PRECISION).sort()).toEqual(ids);
    expect(Object.keys(DISPLAY_UNIT).sort()).toEqual(ids);
    expect(ids).toHaveLength(21);
  });
});

describe('mission days (no day 0)', () => {
  it('missionDaysBetween skips day 0', () => {
    expect(missionDaysBetween(-1, 1)).toBe(1);
    expect(missionDaysBetween(-3, 2)).toBe(4);
    expect(missionDaysBetween(140, 143)).toBe(3);
    expect(missionDaysBetween(-5, -2)).toBe(3);
    expect(missionDaysBetween(2, -1)).toBe(-2);
  });
  it('missionDayWindow', () => {
    expect(missionDayWindow(143, 3)).toEqual([143, 142, 141]);
    expect(missionDayWindow(1, 3)).toEqual([1, -1, -2]);
    expect(missionDayWindow(-10, 2)).toEqual([-10, -11]);
  });
});
