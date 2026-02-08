/**
 * Tests for MCP Sampling Integration
 */
import {
  buildEvaluationPrompt,
  buildExplainPrompt,
  parseEvaluationResponse,
  evaluatePurposeString,
  getContextualSuggestion,
} from './sampling.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('MCP Sampling', () => {
  describe('buildEvaluationPrompt', () => {
    it('should include frameworks and permission', () => {
      const prompt = buildEvaluationPrompt({
        permission: 'Camera (NSCameraUsageDescription)',
        purposeString: 'We need the camera',
        detectedFrameworks: ['AVFoundation', 'CoreLocation'],
        ruleId: 'privacy-001-missing-camera-purpose',
      });

      expect(prompt).toContain('AVFoundation, CoreLocation');
      expect(prompt).toContain('Camera (NSCameraUsageDescription)');
      expect(prompt).toContain('We need the camera');
      expect(prompt).toContain('VERDICT');
    });

    it('should handle empty frameworks', () => {
      const prompt = buildEvaluationPrompt({
        permission: 'Camera',
        purposeString: 'test',
        detectedFrameworks: [],
        ruleId: 'test',
      });

      expect(prompt).toContain('unknown frameworks');
    });
  });

  describe('buildExplainPrompt', () => {
    it('should include rule ID and frameworks', () => {
      const prompt = buildExplainPrompt('privacy-001-missing-camera-purpose', ['AVFoundation']);
      expect(prompt).toContain('privacy-001-missing-camera-purpose');
      expect(prompt).toContain('AVFoundation');
    });
  });

  describe('parseEvaluationResponse', () => {
    const baseOpts = {
      permission: 'Camera',
      purposeString: 'We need camera',
      detectedFrameworks: ['AVFoundation'],
      ruleId: 'test',
    };

    it('should parse ADEQUATE verdict', () => {
      const result = parseEvaluationResponse(
        'VERDICT: ADEQUATE\nEVALUATION: The string clearly explains camera usage.\nSUGGESTION: none',
        baseOpts,
      );

      expect(result.isAdequate).toBe(true);
      expect(result.evaluation).toContain('clearly explains');
      expect(result.suggestedString).toBeUndefined();
    });

    it('should parse INADEQUATE verdict with suggestion', () => {
      const result = parseEvaluationResponse(
        'VERDICT: INADEQUATE\nEVALUATION: Too vague.\nSUGGESTION: We use your camera to scan documents for upload.',
        baseOpts,
      );

      expect(result.isAdequate).toBe(false);
      expect(result.evaluation).toBe('Too vague.');
      expect(result.suggestedString).toBe('We use your camera to scan documents for upload.');
    });

    it('should handle malformed response gracefully', () => {
      const result = parseEvaluationResponse('Some random text', baseOpts);

      expect(result.permission).toBe('Camera');
      expect(result.currentString).toBe('We need camera');
      expect(result.evaluation).toBe('Some random text');
    });
  });

  describe('evaluatePurposeString', () => {
    it('should return evaluation when sampling succeeds', async () => {
      const mockServer = {
        createMessage: jest.fn().mockResolvedValue({
          content: { type: 'text', text: 'VERDICT: INADEQUATE\nEVALUATION: Too generic.\nSUGGESTION: We need camera access to scan QR codes.' },
          model: 'test',
          role: 'assistant',
        }),
      } as unknown as Server;

      const result = await evaluatePurposeString(mockServer, {
        permission: 'Camera',
        purposeString: 'Camera access needed',
        detectedFrameworks: ['AVFoundation'],
        ruleId: 'privacy-001',
      });

      expect(result).not.toBeNull();
      expect(result!.isAdequate).toBe(false);
      expect(result!.suggestedString).toContain('QR codes');
      expect(mockServer.createMessage).toHaveBeenCalledTimes(1);
    });

    it('should return null when sampling is not supported', async () => {
      const mockServer = {
        createMessage: jest.fn().mockRejectedValue(new Error('Method not found')),
      } as unknown as Server;

      const result = await evaluatePurposeString(mockServer, {
        permission: 'Camera',
        purposeString: 'test',
        detectedFrameworks: [],
        ruleId: 'test',
      });

      expect(result).toBeNull();
    });

    it('should return null when server throws', async () => {
      const mockServer = {
        createMessage: jest.fn().mockRejectedValue(new Error('Connection lost')),
      } as unknown as Server;

      const result = await evaluatePurposeString(mockServer, {
        permission: 'Camera',
        purposeString: 'test',
        detectedFrameworks: [],
        ruleId: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('getContextualSuggestion', () => {
    it('should return suggestion when sampling succeeds', async () => {
      const mockServer = {
        createMessage: jest.fn().mockResolvedValue({
          content: { type: 'text', text: 'Add a clear camera usage description mentioning document scanning.' },
          model: 'test',
          role: 'assistant',
        }),
      } as unknown as Server;

      const result = await getContextualSuggestion(
        mockServer,
        'privacy-001-missing-camera-purpose',
        ['AVFoundation'],
      );

      expect(result).toContain('document scanning');
    });

    it('should return null when sampling fails', async () => {
      const mockServer = {
        createMessage: jest.fn().mockRejectedValue(new Error('Not supported')),
      } as unknown as Server;

      const result = await getContextualSuggestion(mockServer, 'test', []);
      expect(result).toBeNull();
    });
  });
});
