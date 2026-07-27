const fs = require('fs/promises');
const path = require('path');

let cachedToken = null;
let cachedTokenExpiry = 0;

const MIME_TYPES = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry)
    return cachedToken;

  const tenantId = getRequiredEnv('OUTLOOK_TENANT_ID');
  const clientId = getRequiredEnv('OUTLOOK_CLIENT_ID');
  const clientSecret = getRequiredEnv('OUTLOOK_CLIENT_SECRET');

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok)
    throw new Error(`Failed to acquire Graph access token: ${response.status} ${await response.text()}`);

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function buildAttachment(filePath) {
  const content = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return {
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: path.basename(filePath),
    contentType: MIME_TYPES[ext] || 'application/octet-stream',
    contentBytes: content.toString('base64'),
  };
}

async function sendMail({ to, subject, body, attachmentPaths }) {
  const mailboxUser = getRequiredEnv('OUTLOOK_MAILBOX_USER');
  const token = await getAccessToken();

  const attachments = attachmentPaths && attachmentPaths.length
    ? await Promise.all(attachmentPaths.map(buildAttachment))
    : [];

  const message = {
    subject,
    body: { contentType: 'HTML', content: body },
    toRecipients: to.split(',').map(address => ({ emailAddress: { address: address.trim() } })),
  };
  if (attachments.length)
    message.attachments = attachments;

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailboxUser)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!response.ok)
    throw new Error(`Graph sendMail failed: ${response.status} ${await response.text()}`);
}

module.exports = { sendMail };
