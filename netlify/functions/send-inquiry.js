// Emails a chat transcript to support@hytekhub.com using the Resend API.
// Requires the RESEND_API_KEY environment variable to be set in
// Netlify: Site configuration -> Environment variables.
//
// Resend also requires hytekhub.com to be a verified sending domain
// (Resend dashboard -> Domains) before the "from" address below will work.

const TO_ADDRESS = 'support@hytekhub.com';
const FROM_ADDRESS = 'HyTek Hub Website <inquiries@hytekhub.com>';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildEmailHtml(transcript, contact) {
  const rows = transcript.map((m) => {
    const who = m.role === 'user' ? 'Visitor' : 'Assistant';
    return `<p style="margin:0 0 12px;"><strong>${who}:</strong> ${escapeHtml(m.content)}</p>`;
  }).join('');

  return `
    <div style="font-family:sans-serif; font-size:14px; color:#111;">
      <p><strong>Contact info given:</strong> ${contact ? escapeHtml(contact) : 'Not provided'}</p>
      <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">
      ${rows}
    </div>
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'RESEND_API_KEY is not configured on the server.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { transcript, contact } = payload;
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'transcript array is required.' }) };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: contact || undefined,
        subject: contact ? `New website inquiry from ${contact}` : 'New website inquiry',
        html: buildEmailHtml(transcript, contact)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', response.status, JSON.stringify(data));
      return { statusCode: response.status, body: JSON.stringify({ error: data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email.', detail: err.message })
    };
  }
};
