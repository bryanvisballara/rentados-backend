async function sendBrevoEmail({ to, subject, html }) {
  const apiKey = String(process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Falta configurar el envío de correos.');
    error.statusCode = 503;
    throw error;
  }

  const senderEmail = String(process.env.BREVO_SENDER_EMAIL || 'seguridad@rentados.app').trim();
  const senderName = String(process.env.BREVO_SENDER_NAME || 'Rentados').trim();
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || 'No se pudo enviar el correo de verificación.');
    error.statusCode = 502;
    throw error;
  }
}

module.exports = { sendBrevoEmail };
