/**
 * Tests for MissingLocationPurposeRule
 */
import { MissingLocationPurposeRule } from '../../src/rules/privacy/missing-location-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity } from '../../src/types';

describe('MissingLocationPurposeRule', () => {
  it('should return no findings when no location framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing NSLocationWhenInUseUsageDescription when CoreLocation is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['CoreLocation']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-002-missing-location-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
  });

  it('should detect MapKit as location framework', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['MapKit']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
  });

  it('should find missing Always description when legacy key present', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSLocationWhenInUseUsageDescription: 'We use location to show nearby places',
        NSLocationAlwaysUsageDescription: 'Background location for tracking',
      },
      {},
      new Set(['CoreLocation']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Missing Always And When In Use Description');
  });

  it('should return no findings when both descriptions are valid', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSLocationWhenInUseUsageDescription: 'We use location to show nearby restaurants and provide directions',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Track your runs in the background so you can see your route',
      },
      {},
      new Set(['CoreLocation']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find empty location description', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSLocationWhenInUseUsageDescription: '   ',
      },
      {},
      new Set(['CoreLocation']),
      []
    );

    const findings = await MissingLocationPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Location Usage Description');
  });
});
