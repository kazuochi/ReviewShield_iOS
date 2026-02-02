/**
 * Tests for plist parser
 */
import { parsePlistString, isPlaceholder, structurePlistData } from '../../src/parsers/plist-parser';

describe('parsePlistString', () => {
  it('should parse valid XML plist', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.example.app</string>
    <key>CFBundleName</key>
    <string>MyApp</string>
</dict>
</plist>`;

    const result = parsePlistString(plist);
    
    expect(result['CFBundleIdentifier']).toBe('com.example.app');
    expect(result['CFBundleName']).toBe('MyApp');
  });

  it('should parse plist with usage descriptions', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>NSCameraUsageDescription</key>
    <string>We need camera access for photos</string>
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>We need location for nearby places</string>
</dict>
</plist>`;

    const result = parsePlistString(plist);
    
    expect(result['NSCameraUsageDescription']).toBe('We need camera access for photos');
    expect(result['NSLocationWhenInUseUsageDescription']).toBe('We need location for nearby places');
  });

  it('should parse plist with arrays', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>UIBackgroundModes</key>
    <array>
        <string>location</string>
        <string>audio</string>
    </array>
</dict>
</plist>`;

    const result = parsePlistString(plist);
    
    expect(result['UIBackgroundModes']).toEqual(['location', 'audio']);
  });

  it('should throw on invalid plist', () => {
    expect(() => parsePlistString('not a plist')).toThrow();
  });
});

describe('isPlaceholder', () => {
  it('should detect empty strings', () => {
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('   ')).toBe(true);
  });

  it('should detect very short strings', () => {
    expect(isPlaceholder('test')).toBe(true);
    expect(isPlaceholder('abc')).toBe(true);
  });

  it('should detect common placeholders', () => {
    expect(isPlaceholder('TODO: add description')).toBe(true);
    expect(isPlaceholder('Lorem ipsum dolor sit amet')).toBe(true);
    expect(isPlaceholder('FIXME: need real description')).toBe(true);
    expect(isPlaceholder('Placeholder text here')).toBe(true);
    expect(isPlaceholder('Your app needs camera access')).toBe(true);
    expect(isPlaceholder('testing camera access')).toBe(true);
  });

  it('should accept valid descriptions', () => {
    expect(isPlaceholder('We need camera access to take photos for your profile')).toBe(false);
    expect(isPlaceholder('Location is used to show nearby restaurants and provide directions')).toBe(false);
  });
});

describe('structurePlistData', () => {
  it('should extract usage descriptions', () => {
    const raw = {
      'CFBundleIdentifier': 'com.example.app',
      'NSCameraUsageDescription': 'Camera access',
      'NSLocationWhenInUseUsageDescription': 'Location access',
      'SomeOtherKey': 'value',
    };

    const result = structurePlistData(raw);
    
    expect(result.bundleIdentifier).toBe('com.example.app');
    expect(result.usageDescriptions).toEqual({
      'NSCameraUsageDescription': 'Camera access',
      'NSLocationWhenInUseUsageDescription': 'Location access',
    });
  });

  it('should extract background modes', () => {
    const raw = {
      'UIBackgroundModes': ['location', 'audio'],
    };

    const result = structurePlistData(raw);
    
    expect(result.backgroundModes).toEqual(['location', 'audio']);
  });
});
