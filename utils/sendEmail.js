/**
 * Send an email via Microsoft Graph
 *
 * @param {string} accessToken
 * @param {string} fromUserEmail
 * @param {string[]} toAddress
 * @param {string} subject
 * @param {string} body - HTML body
 * @param {Buffer|null} pdfBuffer
 */
const sendEmail = async (
  accessToken,
  fromUserEmail,
  toAddress,
  subject,
  body,
  pdfBuffer = null
) => {
  if (!accessToken || !fromUserEmail || !Array.isArray(toAddress)) {
    throw new Error('sendEmail: missing required arguments');
  }

  const emailBody = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: toAddress.map(address => ({
        emailAddress: { address },
      })),
    },
    saveToSentItems: false,
  };

  // Optional PDF attachment
  if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
    emailBody.message.attachments = [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: `${subject}.pdf`,
        contentType: 'application/pdf',
        contentBytes: pdfBuffer.toString('base64'),
      },
    ];
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${fromUserEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Send mail failed (${response.status}): ${JSON.stringify(errorData)}`
    );
  }

  return true;
};

module.exports = {
  sendEmail,
};
