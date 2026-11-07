export interface TeamsMessagePayload {
  title: string;
  text: string;
  contractId?: string;
  status?: string;
  themeColor?: string;
}

export interface TeamsSendResult {
  sent: boolean;
  statusCode?: number;
  reason?: string;
}

/**
 * Dispatches a formatted notification message to a Microsoft Teams incoming webhook.
 * Fails safely if webhook URL is not configured or unreachable.
 */
export async function sendTeamsNotification(
  webhookUrl: string | undefined | null,
  payload: TeamsMessagePayload
): Promise<TeamsSendResult> {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim().startsWith('http')) {
    return {
      sent: false,
      reason: 'not_configured',
    };
  }

  const cardPayload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: payload.title,
    themeColor: payload.themeColor || '0076D7',
    title: payload.title,
    sections: [
      {
        activityTitle: payload.title,
        activitySubtitle: `Thời điểm: ${new Date().toLocaleString('vi-VN')}`,
        text: payload.text,
        facts: [
          ...(payload.contractId ? [{ name: 'Mã Hợp Đồng:', value: payload.contractId }] : []),
          ...(payload.status ? [{ name: 'Trạng Thái:', value: payload.status }] : []),
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    });

    if (response.ok) {
      return { sent: true, statusCode: response.status };
    }

    const errText = await response.text();
    return {
      sent: false,
      statusCode: response.status,
      reason: `Teams Webhook trả về lỗi HTTP ${response.status}: ${errText.slice(0, 200)}`,
    };
  } catch (err: any) {
    return {
      sent: false,
      reason: `Lỗi kết nối mạng tới Teams Webhook: ${err.message}`,
    };
  }
}

