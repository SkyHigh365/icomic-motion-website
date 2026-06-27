// Netlify event function — fires automatically when a Netlify form submission
// is created. "submission-created" is a reserved name: no manual wiring needed.
// It sends a welcome email via Resend to whoever joined the waitlist.

const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');

// Load the HTML template. We try a few locations so it works regardless of how
// Netlify bundles the function (paired with `included_files` in netlify.toml).
function loadTemplate() {
  const candidates = [
    path.join(__dirname, 'welcome-email-template.html'),
    path.resolve(process.cwd(), 'netlify/functions/welcome-email-template.html'),
    path.join(__dirname, '../welcome-email-template.html'),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, 'utf-8');
    } catch (_) {
      /* try the next candidate */
    }
  }
  throw new Error(
    'welcome-email-template.html not found. Looked in: ' + candidates.join(' | ')
  );
}

exports.handler = async (event) => {
  try {
    // Netlify delivers the submission as JSON in the request body.
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || {};
    const email = payload.data && payload.data.email;

    if (!email) {
      console.error(
        'submission-created: no email in payload.data —',
        JSON.stringify(payload.data || {})
      );
      return { statusCode: 400, body: 'No email address in submission.' };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('submission-created: RESEND_API_KEY is not set in the environment.');
      return { statusCode: 500, body: 'Email service not configured.' };
    }

    const resend = new Resend(apiKey);
    const html = loadTemplate();

    console.log('submission-created: sending welcome email to', email);

    const { data, error } = await resend.emails.send({
      from: 'iCOMIC MOTION <hello@icomicmotion.com>',
      to: email,
      replyTo: 'hello@icomicmotion.com',
      subject: "You're on the list — iCOMIC MOTION",
      html,
    });

    if (error) {
      console.error('submission-created: Resend returned an error:', JSON.stringify(error));
      return { statusCode: 502, body: 'Failed to send welcome email.' };
    }

    console.log('submission-created: welcome email sent. id =', data && data.id);
    return { statusCode: 200, body: 'Welcome email sent.' };
  } catch (err) {
    console.error(
      'submission-created: unexpected error —',
      err && err.stack ? err.stack : err
    );
    return { statusCode: 500, body: 'Unexpected error sending welcome email.' };
  }
};
