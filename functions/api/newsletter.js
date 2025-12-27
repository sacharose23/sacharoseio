class HttpError extends Error {
  status; code; details;
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
class ValidationError extends HttpError {
  constructor(message, details) { super(400, "VALIDATION_ERROR", message, details); this.name = "ValidationError"; }
}
class KVError extends HttpError {
  constructor(message, details) { super(500, "KV_ERROR", message, details); this.name = "KVError"; }
}
class PostmarkError extends HttpError {
  constructor(message, details) { super(502, "POSTMARK_ERROR", message, details); this.name = "PostmarkError"; }
}

const serializeError = (err) => {
  const name = err?.name || "Error";
  const message = err?.message || String(err);
  const out = { name, message };
  if (err instanceof HttpError) return { ...out, status: err.status, code: err.code, details: err.details };
  return out;
};

const safe = (v) =>
  (v == null ? "" : String(v)).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

const parseEmailAddresses = (EMAIL_ADDRESSES) => {
  let emailAddresses = ["sacha@stormclouddevelopment.com"];
  const raw = (EMAIL_ADDRESSES || "").trim();
  const list = raw ? raw.split(",").map((e) => e.trim()).filter(Boolean) : [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalid = list.filter((e) => !emailRegex.test(e));
  if (!invalid.length && list.length) emailAddresses = list;
  return { emailAddresses, invalid };
};

const parseJsonSafely = async (request) => {
  try { return await request.json(); }
  catch (e) { throw new ValidationError("Invalid JSON body", { original: serializeError(e) }); }
};

const sendEmailPostmark = async (emailAddresses, apiKey, data) => {
  if (!apiKey) throw new PostmarkError("Missing POSTMARK_API_KEY");
  const url = "https://api.postmarkapp.com/email";
  const email = (data?.email || "").trim();
  const page = (data?.page || data?.source || "sacharose.io").toString();
  const createdAt = new Date().toISOString();

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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PostmarkError(`Postmark request failed (${res.status})`, { status: res.status, body: text, from: body.From, to: body.To });
  }

  return { ok: true };
};

const saveToKV = async (STORE, data) => {
  if (!STORE || typeof STORE.put !== "function") throw new KVError("Missing KV binding STORE");
  const email = (data?.email || "").trim().toLowerCase();
  const ts = new Date().toISOString();
  const rand = globalThis.crypto?.randomUUID?.() || `${Math.random()}`.slice(2);
  const key = `newsletter/${ts}/${rand}`;

  try {
    await STORE.put(key, JSON.stringify({ ...data, email, submitted_at: ts }), { metadata: { email } });
  } catch (e) {
    throw new KVError("Failed to write to KV", { key, original: serializeError(e) });
  }

  return { ok: true, key };
};

export const onRequestPost = async (context) => {
  const { request } = context;
  const { STORE, POSTMARK_API_KEY, EMAIL_ADDRESSES } = context.env || {};

  try {
    const data = await parseJsonSafely(request);
    const email = (data?.email || "").trim();
    if (!email) throw new ValidationError("Email is required");

    const { emailAddresses, invalid } = parseEmailAddresses(EMAIL_ADDRESSES);
    if (invalid.length) throw new ValidationError("EMAIL_ADDRESSES contains invalid emails", { invalid });

    const [emailResult, kvResult] = await Promise.allSettled([
      sendEmailPostmark(emailAddresses, POSTMARK_API_KEY, data),
      saveToKV(STORE, data),
    ]);

    const out = { ok: true, email: { ok: false }, kv: { ok: false } };

    if (emailResult.status === "fulfilled") out.email = { ok: true };
    else {
      out.email = { ok: false, error: serializeError(emailResult.reason) };
      console.error("newsletter:postmark_failed", out.email.error);
    }

    if (kvResult.status === "fulfilled") out.kv = { ok: true, key: kvResult.value.key };
    else {
      out.kv = { ok: false, error: serializeError(kvResult.reason) };
      console.error("newsletter:kv_failed", out.kv.error);
      const status = kvResult.reason instanceof HttpError ? kvResult.reason.status : 500;
      return new Response(JSON.stringify(out), { status, headers: { "Content-Type": "application/json" } });
    }

    // 201 if both worked, 202 if KV worked but email failed (best-effort email)
    const status = out.email.ok ? 201 : 202;
    return new Response(JSON.stringify(out), { status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(500, "UNHANDLED_ERROR", "Error processing form data", { original: serializeError(err) });
    console.error("newsletter:request_failed", serializeError(e));
    return new Response(JSON.stringify({ ok: false, error: serializeError(e) }), {
      status: e.status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
