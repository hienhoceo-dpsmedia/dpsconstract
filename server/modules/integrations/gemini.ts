import { GoogleGenAI } from '@google/genai';

export interface ExtractedContractMetadata {
  status: 'success' | 'not_configured' | 'error';
  message?: string;
  data?: {
    partnerName?: string;
    contractNumber?: string;
    valueText?: string;
    valueAmount?: number;
    signDate?: string;
    effectiveDate?: string;
    summary?: string;
  };
}

/**
 * Extracts structured contract metadata using Gemini 2.5 Flash.
 * Returns { status: 'not_configured' } safely when GEMINI_API_KEY is not set.
 */
export async function extractContractMetadata(
  textOrBuffer: string | Buffer,
  mimeType: string = 'text/plain'
): Promise<ExtractedContractMetadata> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return {
      status: 'not_configured',
      message: 'Gemini API key is not configured in server environment',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const content = Buffer.isBuffer(textOrBuffer)
      ? textOrBuffer.toString('utf-8')
      : String(textOrBuffer);

    const prompt = `Bạn là chuyên gia thẩm định hợp đồng pháp lý của DPS Media. Hãy đọc nội dung văn bản hợp đồng dưới đây và trích xuất các trường thông tin quan trọng dưới định dạng JSON:
{
  "partnerName": "Tên đối tác hoặc công ty ký kết",
  "contractNumber": "Số hiệu hợp đồng (nếu có trong văn bản)",
  "valueText": "Giá trị hợp đồng bằng chữ hoặc số (VD: 100.000.000 VNĐ)",
  "valueAmount": 100000000,
  "signDate": "YYYY-MM-DD",
  "effectiveDate": "YYYY-MM-DD",
  "summary": "Tóm tắt ngắn gọn phạm vi công việc trong 2 câu"
}

Chỉ trả về JSON thuần túy, không bọc markdown block.

Nội dung hợp đồng:
${content.slice(0, 15000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const responseText = response.text || '';
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return {
        status: 'success',
        data: {
          partnerName: parsed.partnerName || undefined,
          contractNumber: parsed.contractNumber || undefined,
          valueText: parsed.valueText || undefined,
          valueAmount: typeof parsed.valueAmount === 'number' ? parsed.valueAmount : undefined,
          signDate: parsed.signDate || undefined,
          effectiveDate: parsed.effectiveDate || undefined,
          summary: parsed.summary || undefined,
        },
      };
    } catch {
      return {
        status: 'success',
        data: {
          summary: responseText.slice(0, 300),
        },
      };
    }
  } catch (err: any) {
    return {
      status: 'error',
      message: `Lỗi gọi Gemini API: ${err.message}`,
    };
  }
}

