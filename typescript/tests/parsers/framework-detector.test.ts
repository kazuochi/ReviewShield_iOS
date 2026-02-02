/**
 * Tests for framework detector
 */
import {
  parsePodfileLockContent,
  parsePackageResolvedData,
  parseProjectFrameworksContent,
  detectTrackingSDKs,
  detectSocialLoginSDKs,
} from '../../src/parsers/framework-detector';
import { Dependency, DependencySource } from '../../src/types';

describe('parsePodfileLockContent', () => {
  it('should parse Podfile.lock dependencies', () => {
    const content = `
PODS:
  - Alamofire (5.6.4)
  - Firebase/Analytics (10.0.0):
    - FirebaseAnalytics
  - GoogleSignIn (6.0.0)
  - FBSDKLoginKit (14.0.0)

DEPENDENCIES:
  - Alamofire
  - Firebase/Analytics
`;

    const result = parsePodfileLockContent(content);
    
    expect(result).toContainEqual({
      name: 'Alamofire',
      version: '5.6.4',
      source: DependencySource.CocoaPods,
    });
    expect(result).toContainEqual({
      name: 'Firebase',
      version: '10.0.0',
      source: DependencySource.CocoaPods,
    });
    expect(result).toContainEqual({
      name: 'Firebase/Analytics',
      version: '10.0.0',
      source: DependencySource.CocoaPods,
    });
  });

  it('should handle empty Podfile.lock', () => {
    const result = parsePodfileLockContent('');
    expect(result).toEqual([]);
  });
});

describe('parsePackageResolvedData', () => {
  it('should parse Package.resolved v2 format', () => {
    const json = {
      pins: [
        {
          identity: 'alamofire',
          state: { version: '5.6.4' },
        },
        {
          identity: 'firebase-ios-sdk',
          state: { version: '10.0.0' },
        },
      ],
      version: 2,
    };

    const result = parsePackageResolvedData(json);
    
    expect(result).toContainEqual({
      name: 'alamofire',
      version: '5.6.4',
      source: DependencySource.SPM,
    });
    expect(result).toContainEqual({
      name: 'firebase-ios-sdk',
      version: '10.0.0',
      source: DependencySource.SPM,
    });
  });

  it('should parse Package.resolved v1 format', () => {
    const json = {
      object: {
        pins: [
          {
            package: 'Alamofire',
            state: { version: '5.6.4' },
          },
        ],
      },
      version: 1,
    };

    const result = parsePackageResolvedData(json);
    
    expect(result).toContainEqual({
      name: 'Alamofire',
      version: '5.6.4',
      source: DependencySource.SPM,
    });
  });
});

describe('parseProjectFrameworksContent', () => {
  it('should extract framework names', () => {
    const content = `
      files = (
        AB123456 /* AVFoundation.framework */,
        CD789012 /* CoreLocation.framework */,
        EF345678 /* UIKit.framework */,
      );
    `;

    const result = parseProjectFrameworksContent(content);
    
    expect(result).toContain('AVFoundation');
    expect(result).toContain('CoreLocation');
    expect(result).toContain('UIKit');
  });
});

describe('detectTrackingSDKs', () => {
  it('should detect Facebook SDK', () => {
    const deps: Dependency[] = [
      { name: 'FBSDKCoreKit', version: '14.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectTrackingSDKs(deps);
    
    expect(result).toContain('Facebook SDK');
  });

  it('should detect multiple tracking SDKs', () => {
    const deps: Dependency[] = [
      { name: 'FirebaseAnalytics', version: '10.0.0', source: DependencySource.CocoaPods },
      { name: 'Adjust', version: '4.0.0', source: DependencySource.CocoaPods },
      { name: 'AppsFlyer', version: '6.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectTrackingSDKs(deps);
    
    expect(result).toContain('Firebase Analytics');
    expect(result).toContain('Adjust');
    expect(result).toContain('AppsFlyer');
  });

  it('should return empty for no tracking SDKs', () => {
    const deps: Dependency[] = [
      { name: 'Alamofire', version: '5.6.4', source: DependencySource.CocoaPods },
      { name: 'SwiftyJSON', version: '5.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectTrackingSDKs(deps);
    
    expect(result).toEqual([]);
  });
});

describe('detectSocialLoginSDKs', () => {
  it('should detect Google Sign-In', () => {
    const deps: Dependency[] = [
      { name: 'GoogleSignIn', version: '6.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectSocialLoginSDKs(deps);
    
    expect(result).toContain('Google Sign-In');
  });

  it('should detect Facebook Login', () => {
    const deps: Dependency[] = [
      { name: 'FBSDKLoginKit', version: '14.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectSocialLoginSDKs(deps);
    
    expect(result).toContain('Facebook Login');
  });

  it('should detect Firebase Auth', () => {
    const deps: Dependency[] = [
      { name: 'FirebaseAuth', version: '10.0.0', source: DependencySource.CocoaPods },
    ];

    const result = detectSocialLoginSDKs(deps);
    
    expect(result).toContain('Firebase Auth');
  });
});
