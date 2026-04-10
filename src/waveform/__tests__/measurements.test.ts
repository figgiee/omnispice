import { describe, it, expect } from 'vitest';
import {
  measureVpp,
  measureFrequency,
  measureRMS,
  measureRiseTime,
  formatValue,
} from '../measurements';

describe('measureVpp', () => {
  it('returns Vpp for sine wave data', () => {
    const data = Float64Array.from([0, 1, 0, -1, 0, 1, 0, -1]);
    const result = measureVpp(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(2.0);
    expect(result!.label).toBe('Vpp');
    expect(result!.unit).toBe('V');
  });

  it('returns Vpp of 0 for DC data', () => {
    const data = Float64Array.from([5, 5, 5, 5]);
    const result = measureVpp(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(0.0);
  });

  it('returns null for empty array', () => {
    const data = new Float64Array(0);
    const result = measureVpp(data);
    expect(result).toBeNull();
  });

  it('returns null for single element', () => {
    const data = Float64Array.from([3.14]);
    const result = measureVpp(data);
    // Single element: max - min = 0, but still valid
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(0.0);
  });

  it('handles large amplitude signals', () => {
    const data = Float64Array.from([-100, 0, 100]);
    const result = measureVpp(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(200.0);
  });
});

describe('measureFrequency', () => {
  it('returns approximately 1000 Hz for 1kHz sine wave', () => {
    // 1kHz sine sampled at 100kHz: period = 1ms = 100 samples
    const sampleRate = 100000; // 100 kHz
    const frequency = 1000; // 1 kHz
    const numSamples = 500; // 5 full cycles
    const timeData = new Float64Array(numSamples);
    const signalData = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      timeData[i] = i / sampleRate;
      signalData[i] = Math.sin(2 * Math.PI * frequency * timeData[i]!);
    }

    const result = measureFrequency(timeData, signalData);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(1000, -1); // within ~10 Hz
    expect(result!.label).toBe('Frequency');
    expect(result!.unit).toBe('Hz');
  });

  it('returns null for DC data', () => {
    const timeData = Float64Array.from([0, 0.001, 0.002, 0.003]);
    const signalData = Float64Array.from([5, 5, 5, 5]);
    const result = measureFrequency(timeData, signalData);
    expect(result).toBeNull();
  });

  it('returns null for empty arrays', () => {
    const timeData = new Float64Array(0);
    const signalData = new Float64Array(0);
    const result = measureFrequency(timeData, signalData);
    expect(result).toBeNull();
  });

  it('returns null for signal with fewer than 2 zero crossings', () => {
    // Only goes positive once, never comes back
    const timeData = Float64Array.from([0, 0.001, 0.002, 0.003]);
    const signalData = Float64Array.from([-1, 1, 2, 3]);
    const result = measureFrequency(timeData, signalData);
    expect(result).toBeNull();
  });

  it('detects frequency of a 10 Hz signal', () => {
    const sampleRate = 1000;
    const frequency = 10;
    const numSamples = 500;
    const timeData = new Float64Array(numSamples);
    const signalData = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      timeData[i] = i / sampleRate;
      signalData[i] = Math.sin(2 * Math.PI * frequency * timeData[i]!);
    }

    const result = measureFrequency(timeData, signalData);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(10, 0);
  });
});

describe('measureRMS', () => {
  it('returns approximately 0.707 for unit sine wave', () => {
    // Generate a full cycle of sine wave (enough samples for accuracy)
    const numSamples = 10000;
    const data = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      data[i] = Math.sin((2 * Math.PI * i) / numSamples);
    }

    const result = measureRMS(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(1 / Math.sqrt(2), 2); // ~0.707
    expect(result!.label).toBe('RMS');
    expect(result!.unit).toBe('V');
  });

  it('returns 5.0 for DC value of 5', () => {
    const data = Float64Array.from([5, 5, 5, 5]);
    const result = measureRMS(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(5.0);
  });

  it('returns null for empty array', () => {
    const data = new Float64Array(0);
    const result = measureRMS(data);
    expect(result).toBeNull();
  });

  it('returns correct RMS for single element', () => {
    const data = Float64Array.from([3.0]);
    const result = measureRMS(data);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(3.0);
  });
});

describe('measureRiseTime', () => {
  it('returns correct rise time for step response', () => {
    // Step response: 0 to 1V with known rise time
    // Create a linear ramp from 0 to 1 over 100us, then hold at 1V
    const numSamples = 200;
    const timeData = new Float64Array(numSamples);
    const signalData = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      timeData[i] = i * 1e-6; // 1us per sample
      if (i < 100) {
        signalData[i] = i / 100; // ramp from 0 to 1 over 100 samples
      } else {
        signalData[i] = 1.0;
      }
    }

    // Rise time from 10% to 90% of (max-min):
    // 10% = 0.1, reached at sample 10 (10us)
    // 90% = 0.9, reached at sample 90 (90us)
    // Expected rise time = 80us = 8e-5s
    const result = measureRiseTime(timeData, signalData);
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(80e-6, 6);
    expect(result!.label).toBe('Rise Time');
    expect(result!.unit).toBe('s');
  });

  it('returns null for constant signal', () => {
    const timeData = Float64Array.from([0, 0.001, 0.002, 0.003]);
    const signalData = Float64Array.from([5, 5, 5, 5]);
    const result = measureRiseTime(timeData, signalData);
    expect(result).toBeNull();
  });

  it('returns null for empty arrays', () => {
    const timeData = new Float64Array(0);
    const signalData = new Float64Array(0);
    const result = measureRiseTime(timeData, signalData);
    expect(result).toBeNull();
  });

  it('handles signal that does not cross both thresholds', () => {
    // Signal goes from 0 to 0.5 (only reaches 50%, not 90%)
    const timeData = Float64Array.from([0, 0.001, 0.002, 0.003, 0.004]);
    const signalData = Float64Array.from([0, 0.1, 0.2, 0.3, 0.5]);
    // max=0.5, min=0. 10%=0.05, 90%=0.45
    // Signal crosses 0.05 at ~sample 0-1 and 0.45 at ~sample 3-4
    const result = measureRiseTime(timeData, signalData);
    // Should find crossings via interpolation
    expect(result).not.toBeNull();
  });
});

describe('formatValue', () => {
  it('formats milli values', () => {
    expect(formatValue(0.001, 's')).toBe('1.00 ms');
  });

  it('formats micro values', () => {
    expect(formatValue(0.000001, 's')).toBe('1.00 us');
  });

  it('formats nano values', () => {
    expect(formatValue(1e-9, 's')).toBe('1.00 ns');
  });

  it('formats kilo values', () => {
    expect(formatValue(1000, 'Hz')).toBe('1.00 kHz');
  });

  it('formats mega values', () => {
    expect(formatValue(1e6, 'Hz')).toBe('1.00 MHz');
  });

  it('formats giga values', () => {
    expect(formatValue(1e9, 'Hz')).toBe('1.00 GHz');
  });

  it('formats values without prefix', () => {
    expect(formatValue(5.0, 'V')).toBe('5.00 V');
  });

  it('formats zero', () => {
    expect(formatValue(0, 'V')).toBe('0.00 V');
  });

  it('formats small fractional values', () => {
    expect(formatValue(0.123, 'V')).toBe('123.00 mV');
  });

  it('formats pico values', () => {
    expect(formatValue(1e-12, 's')).toBe('1.00 ps');
  });
});
