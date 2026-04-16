// /.netlify/functions/create-checkout
// Creates a Stripe Checkout session for new subscribers

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify auth
  const context = event.clientContext || {};
  const user = context.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'http://localhost:8888';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      customer_email: user.email,
      client_reference_id: user.sub, // Netlify Identity user ID
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/app.html`,
      subscription_data: {
        metadata: {
          netlify_user_id: user.sub,
          netlify_user_email: user.email,
        }
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create checkout session' }) };
  }
};
