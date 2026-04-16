const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  let user;
  try {
    const context = event.clientContext || {};
    user = context.user;

    if (!user && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const payload = token.split('.')[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        user = {
          sub: decoded.sub,
          email: decoded.email,
          created_at: new Date(decoded.iat * 1000).toISOString(),
          app_metadata: decoded.app_metadata || {}
        };
      }
    }

    if (!user) throw new Error('No user context');
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const roles = user.app_metadata?.roles || [];
  const hasPaid = roles.includes('paid');

  if (!hasPaid) {
    const created = new Date(user.created_at);
    const daysSince = (Date.now() - created) / (1000 * 60 * 60 * 24);
    if (daysSince > 14) {
      return { statusCode: 402, body: JSON.stringify({ error: 'Trial expired.' }) };
    }
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }; }

  const {
    clientName, practiceArea, incidentDate, caseDescription,
    damages, opposingParty, priorAttorney, solConcern, evidence, insurance, notes
  } = body;

  if (!caseDescription || !damages) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const incidentStr = incidentDate
    ? new Date(incidentDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not specified';

  const prompt = `You are an experienced law firm intake specialist evaluating whether a firm should accept a new case.

--- INTAKE ---
Client: ${clientName || 'Not provided'}
Practice Area: ${practiceArea || 'Not specified'}
Incident Date: ${incidentStr}
Screening Date: ${today}

Case Description:
${caseDescription}

Alleged Damages:
${damages}

Opposing Party: ${opposingParty || 'Not specified'}
Prior Attorney: ${priorAttorney}
SOL Concern: ${solConcern}
Evidence Available: ${evidence}
Adverse Party Insured: ${insurance}
Additional Notes: ${notes || 'None'}
---

Respond ONLY with a valid JSON object (no markdown, no code fences):

{
  "recommendation": "ACCEPT" or "DECLINE" or "NEEDS REVIEW",
  "confidence": <integer 0-100>,
  "summary": "<one sentence case summary and rationale>",
  "accept_factors": ["<factor>", ...],
  "decline_factors": ["<factor>", ...],
  "key_risks": ["<risk>", ...],
  "next_steps": ["<step>", ...]
}

Guidelines:
- accept_factors: reasons to take the case
- decline_factors: reasons not to
- key_risks: specific risks if accepted
- next_steps: concrete immediate actions
- 2-5 items per list, specific and actionable
- NEEDS REVIEW when too ambiguous for a firm call`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = message.content[0].text.trim();
    raw = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(raw);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('Screen function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Screening failed. Please try again.' }) };
  }
};
