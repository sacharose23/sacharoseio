/* eslint-disable no-console */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const safe = (v) =>
  (v == null ? "" : String(v)).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

const saveToKV = async (STORE, data) => {
  if (!STORE || typeof STORE.put !== "function") throw new Error("Missing KV binding STORE");
  const email = (data && data.email ? String(data.email) : "").trim().toLowerCase();
  const ts = new Date().toISOString();
  const rand = globalThis.crypto?.randomUUID?.() || `${Math.random()}`.slice(2);
  const key = `newsletter/${ts}/${rand}`;
  await STORE.put(key, JSON.stringify({ ...data, email, submitted_at: ts }), { metadata: { email } });
  return { key };
};

const sendEmailPostmark = async (apiKey, data) => {
  if (!apiKey) throw new Error("Missing POSTMARK_API_KEY");

  const FROM = "sacha@stormclouddevelopment.com";
  const TO = "sacharoseuritis@gmail.com";

  const email = (data && data.email ? String(data.email) : "").trim();
  const page = (data && (data.page || data.source) ? String(data.page || data.source) : "sacharose.io");
  const createdAt = new Date().toISOString();

  const body = {
    From: FROM,
    To: TO,
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

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    const err = new Error(`Postmark failed (${res.status})`);
    err.status = res.status;
    err.details = details;
    err.from = FROM;
    err.to = TO;
    throw err;
  }
};

export const onRequestPost = async (context) => {
  const env = context?.env || {};
  const STORE = env.STORE;
  const POSTMARK_API_KEY = env.POSTMARK_API_KEY;

  let data;
  try {
    data = await context.request.json();
  } catch (e) {
    console.error("newsletter:invalid_json", e);
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const submittedEmail = (data && data.email ? String(data.email) : "").trim();
  if (!submittedEmail) return json({ ok: false, error: "Email is required" }, 400);

  const [kvResult, emailResult] = await Promise.allSettled([
    saveToKV(STORE, data),
    sendEmailPostmark(POSTMARK_API_KEY, data),
  ]);

  const kvOk = kvResult.status === "fulfilled";
  const emailOk = emailResult.status === "fulfilled";

  if (!kvOk) console.error("newsletter:kv_failed", kvResult.reason);
  if (!emailOk) console.error("newsletter:postmark_failed", emailResult.reason);

  if (!kvOk && !emailOk) {
    return json({ ok: false, error: "Newsletter signup failed", kv: { ok: false }, email: { ok: false } }, 500);
  }

  if (kvOk && emailOk) {
    return json({ ok: true, kv: { ok: true, key: kvResult.value.key }, email: { ok: true } }, 201);
  }

  return json(
    {
      ok: true,
      warning: kvOk ? "Signup saved, but email notification failed." : "Email sent, but signup could not be saved.",
      kv: kvOk ? { ok: true, key: kvResult.value.key } : { ok: false },
      email: emailOk ? { ok: true } : { ok: false },
    },
    202
  );
};
