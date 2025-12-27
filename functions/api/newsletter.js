const sendEmailPostmark = async (emailAddresses, apiKey, data) => {
  const url = "https://api.postmarkapp.com/email";
  const email = (data?.email || "").trim();
  const page = (data?.page || data?.source || "sacharose.io").toString();
  const createdAt = new Date().toISOString();

  const safe = (v) => (v == null ? "" : String(v)).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

  const body = {
    From: emailAddresses[0],
    To: emailAddresses.join(","),
    Subject: "New newsletter signup — sacharose.io",
    HtmlBody: `
      <strong>New signup</strong><br/>
      <strong>Email:</strong> ${safe(email)}<br/>
      <strong>Source:</strong> ${safe(page)}<br/>
      <strong>Time:</strong> ${safe(createdAt)}<br/>
    `,
    TextBody: `New signup\nEmail: ${email}\nSource: ${page}\nTime: ${createdAt}`,
    ReplyTo: email || undefined,
    MessageStream: "outbound",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to send email via Postmark (${response.status}): ${errorText}`);
  }
};

const saveToKV = async (STORE, data) => {
  const email = (data?.email || "").trim().toLowerCase();
  const ts = new Date().toISOString();
  const rand = crypto?.randomUUID?.() || `${Math.random()}`.slice(2);
  const key = `newsletter/${ts}/${rand}`;

  await STORE.put(
    key,
    JSON.stringify({ ...data, email, submitted_at: ts }),
    { metadata: { email } }
  );
};

const handlePromise = (promise) =>
  promise.then((result) => ({ success: true, result })).catch((error) => ({ success: false, error }));

export const onRequestPost = async (context) => {
  const { request } = context;
  const { STORE, POSTMARK_API_KEY, EMAIL_ADDRESSES } = context.env;

  try {
    const data = await request.json();
    const email = (data?.email || "").trim();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let emailAddresses = ["sacha@stormclouddevelopment.com"];

    const raw = (EMAIL_ADDRESSES || "").trim();
    const EMAILS = raw ? raw.split(",").map((e) => e.trim()).filter(Boolean) : [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = EMAILS.filter((e) => !emailRegex.test(e));

    if (invalidEmails.length === 0 && EMAILS.length > 0) emailAddresses = EMAILS;

    const results = await Promise.all([
      handlePromise(sendEmailPostmark(emailAddresses, POSTMARK_API_KEY, data)),
      handlePromise(saveToKV(STORE, data)),
    ]);

    const errors = results.filter((r) => !r.success).map((r) => r.error?.message || "Unknown error");
    if (errors.length) {
      return new Response(JSON.stringify({ errors }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Error processing form data" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
