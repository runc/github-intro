import { describe, expect, it } from 'vitest';
import { liveCaptureAvailable } from '../src/export/capture';

describe('liveCaptureAvailable', () => {
  it('无 CropTarget/RestrictionTarget 时不可用(Node/jsdom)', () => {
    expect(liveCaptureAvailable()).toBe(false);
  });
});