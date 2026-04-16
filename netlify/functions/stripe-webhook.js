// /.netlify/functions/stripe-webhook
// Listens for Stripe events and grants/revokes the "paid" role in Netlify Identity

const Stripe = require('stripe');

const NETLIFY_IDENTITY_URL = process.env.URL
  ? `${process.env.URL}/.netlify/identity`
  : 'http://localhost:8888/.netlify/identity';

async function setUserRole(userId, addPaid) {
  // Uses Netlify Identity admin API to update user roles
  const res = await fetch(`${NETLIFY_IDENTITY_URL}/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.NETLIFY_IDENTITY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_metadata: { roles: addPaid ? ['paid'] : [] }
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Identity update failed: ${res.status} ${text}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  const session = stripeEvent.data.object;

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        // Payment succeeded — grant "paid" role
        const userId = session.client_reference_id;
        if (userId) {
          await setUserRole(userId, true);
          console.log(`Granted paid role to user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled — revoke "paid" role
        const userId = session.metadata?.netlify_user_id;
        if (userId) {
          await setUserRole(userId, false);
          console.log(`Revoked paid role from user ${userId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Optional: handle failed renewal (e.g. send email)
        console.log(`Payment failed for customer: ${session.customer}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Webhook handler error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
