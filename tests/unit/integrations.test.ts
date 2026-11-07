import { describe, it, expect } from 'vitest';
import { sendTeamsNotification } from '../../server/modules/integrations/teams.js';
import { mapVtpStatusCode } from '../../server/modules/integrations/vtp.js';
import { extractContractMetadata } from '../../server/modules/integrations/gemini.js';

describe('External Integrations Unit Tests (T44, T45, T47)', () => {
  describe('Teams Webhook (T44)', () => {
    it('returns not_configured when webhook URL is missing or empty', async () => {
      const res1 = await sendTeamsNotification('', {
        title: 'Test',
        text: 'Hello',
      });
      expect(res1.sent).toBe(false);
      expect(res1.reason).toBe('not_configured');

      const res2 = await sendTeamsNotification(null, {
        title: 'Test',
        text: 'Hello',
      });
      expect(res2.sent).toBe(false);
      expect(res2.reason).toBe('not_configured');
    });

    it('rejects invalid non-HTTP URL safely without throwing unhandled exceptions', async () => {
      const res = await sendTeamsNotification('ftp://invalid-url', {
        title: 'Test',
        text: 'Hello',
      });
      expect(res.sent).toBe(false);
      expect(res.reason).toBe('not_configured');
    });
  });

  describe('Viettel Post Status Code Mapping (T45)', () => {
    it('maps pickup status codes (100-103) to "Chờ shipper đến lấy"', () => {
      const res100 = mapVtpStatusCode(100);
      expect(res100.normalizedStatus).toBe('pickup');
      expect(res100.targetContractStatus).toBe('Chờ shipper đến lấy');

      const res102 = mapVtpStatusCode(102);
      expect(res102.normalizedStatus).toBe('pickup');
    });

    it('maps in-transit status codes (104, 200, 300) to "Đang giao"', () => {
      const res104 = mapVtpStatusCode(104);
      expect(res104.normalizedStatus).toBe('in_transit');
      expect(res104.targetContractStatus).toBe('Đang giao');

      const res200 = mapVtpStatusCode('200');
      expect(res200.normalizedStatus).toBe('in_transit');
    });

    it('maps delivery success status codes (500, 501) to "Chờ bản gửi lại"', () => {
      const res500 = mapVtpStatusCode(500);
      expect(res500.normalizedStatus).toBe('delivered');
      expect(res500.targetContractStatus).toBe('Chờ bản gửi lại');
    });

    it('maps delivery failure status codes (504, 505) to "Sự cố vận chuyển"', () => {
      const res504 = mapVtpStatusCode(504);
      expect(res504.normalizedStatus).toBe('issue');
      expect(res504.targetContractStatus).toBe('Sự cố vận chuyển');
    });

    it('handles unrecognized status codes gracefully', () => {
      const res999 = mapVtpStatusCode(9999);
      expect(res999.normalizedStatus).toBe('unknown');
    });
  });

  describe('Gemini API Metadata Extraction (T47)', () => {
    it('returns not_configured status when GEMINI_API_KEY is not set', async () => {
      const prevKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = await extractContractMetadata('Hợp đồng dịch vụ thử nghiệm');
      expect(result.status).toBe('not_configured');
      expect(result.message).toContain('not configured');

      if (prevKey) {
        process.env.GEMINI_API_KEY = prevKey;
      }
    });
  });
});

