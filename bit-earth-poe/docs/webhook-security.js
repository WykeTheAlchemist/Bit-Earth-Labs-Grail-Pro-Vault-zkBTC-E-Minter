// Verify webhook signature
const crypto = require('crypto');

function verifyWebhook(req, secret) {
  const signature = req.headers['x-bitearth-signature'];
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
