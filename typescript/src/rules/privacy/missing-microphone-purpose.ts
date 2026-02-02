/**
 * Rule: Missing Microphone Usage Description
 * 
 * Detects when an app uses audio recording frameworks without the required
 * NSMicrophoneUsageDescription in Info.plist.
 * 
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding, makeCustomFinding } from '../base.js';

// Frameworks that definitely use microphone for recording
const MICROPHONE_FRAMEWORKS = ['AVFAudio', 'Speech'];
const MICROPHONE_KEY = 'NSMicrophoneUsageDescription';
const SPEECH_KEY = 'NSSpeechRecognitionUsageDescription';

export const MissingMicrophonePurposeRule: Rule = {
  id: 'privacy-005-missing-microphone-purpose',
  name: 'Missing Microphone Usage Description',
  description: 'Checks for audio recording framework usage without NSMicrophoneUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Check if any audio recording framework is linked
    const detectedFrameworks = MICROPHONE_FRAMEWORKS.filter(f => context.hasFramework(f));
    
    // AVFoundation CAN record audio but is also used by virtually every app that plays video/audio.
    // Only flag it with lower confidence when no other microphone frameworks are present.
    const hasAVFoundation = context.hasFramework('AVFoundation');
    const hasOnlyAVFoundation = hasAVFoundation && detectedFrameworks.length === 0;
    
    if (detectedFrameworks.length === 0 && !hasAVFoundation) {
      return [];
    }

    const findings: Finding[] = [];
    const microphoneDescription = context.plistString(MICROPHONE_KEY);
    const speechDescription = context.plistString(SPEECH_KEY);
    
    // Determine which frameworks to report
    const frameworksToReport = hasAVFoundation 
      ? [...detectedFrameworks, 'AVFoundation']
      : detectedFrameworks;

    // If Speech framework is linked, check for speech recognition description
    if (context.hasFramework('Speech')) {
      if (speechDescription === undefined) {
        findings.push(makeFinding(this, {
          title: 'Missing Speech Recognition Usage Description',
          description: `Your app links against the Speech framework but Info.plist is missing ` +
            `NSSpeechRecognitionUsageDescription. Apps using speech recognition must provide a ` +
            `purpose string explaining why access is needed.`,
          location: 'Info.plist',
          fixGuidance: `Add NSSpeechRecognitionUsageDescription to your Info.plist:

<key>NSSpeechRecognitionUsageDescription</key>
<string>We use speech recognition to transcribe your voice notes.</string>

Note: You'll also need NSMicrophoneUsageDescription since speech recognition requires microphone access.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      } else if (speechDescription.trim() === '') {
        findings.push(makeFinding(this, {
          title: 'Empty Speech Recognition Usage Description',
          description: `NSSpeechRecognitionUsageDescription exists but is empty.`,
          location: 'Info.plist',
          fixGuidance: `Provide a meaningful description for speech recognition usage.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      } else if (isPlaceholder(speechDescription)) {
        findings.push(makeFinding(this, {
          title: 'Placeholder Speech Recognition Usage Description',
          description: `NSSpeechRecognitionUsageDescription contains placeholder text: "${speechDescription}".`,
          location: 'Info.plist',
          fixGuidance: `Replace the placeholder with a real description of your speech recognition feature.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      }
    }

    // When only AVFoundation is detected (no AVFAudio/Speech), use Medium confidence
    // since AVFoundation is commonly used for audio/video playback, not just recording
    const confidenceLevel = hasOnlyAVFoundation ? Confidence.Medium : Confidence.High;
    const avFoundationCaveat = hasOnlyAVFoundation 
      ? `\n\nNote: AVFoundation is commonly used for audio/video playback. If your app only plays ` +
        `media and doesn't record audio, you may not need this permission.`
      : '';

    // Case 1: Completely missing microphone description
    if (microphoneDescription === undefined) {
      findings.push(makeCustomFinding(this, this.severity, confidenceLevel, {
        title: 'Missing Microphone Usage Description',
        description: `Your app links against audio frameworks (${frameworksToReport.join(', ')}) ` +
          `but Info.plist is missing NSMicrophoneUsageDescription. Apps that access the microphone ` +
          `must provide a purpose string explaining why access is needed.${avFoundationCaveat}`,
        location: 'Info.plist',
        fixGuidance: `Add NSMicrophoneUsageDescription to your Info.plist with a clear, user-facing explanation ` +
          `of why your app needs microphone access. For example:

<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access to record voice messages and make calls.</string>

The description should explain the specific feature that uses the microphone.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }
    // Case 2: Empty description
    else if (microphoneDescription.trim() === '') {
      findings.push(makeCustomFinding(this, this.severity, confidenceLevel, {
        title: 'Empty Microphone Usage Description',
        description: `NSMicrophoneUsageDescription exists in Info.plist but is empty. ` +
          `Apple requires a meaningful description explaining why your app needs microphone access.${avFoundationCaveat}`,
        location: 'Info.plist',
        fixGuidance: `Update NSMicrophoneUsageDescription with a clear, specific explanation of why your app ` +
          `needs microphone access. Generic or empty descriptions will be rejected.

Good example: "Record audio for your video messages."
Bad example: "Microphone access required" or ""`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }
    // Case 3: Placeholder text detected
    else if (isPlaceholder(microphoneDescription)) {
      findings.push(makeCustomFinding(this, this.severity, confidenceLevel, {
        title: 'Placeholder Microphone Usage Description',
        description: `NSMicrophoneUsageDescription appears to contain placeholder text: "${microphoneDescription}". ` +
          `Apple requires meaningful, user-facing descriptions.${avFoundationCaveat}`,
        location: 'Info.plist',
        fixGuidance: `Replace the placeholder text with a clear explanation of why your app needs microphone access. ` +
          `The description should be specific to your app's features.

Current value: "${microphoneDescription}"

Write a description that helps users understand what feature uses the microphone and why.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }

    return findings;
  },
};
