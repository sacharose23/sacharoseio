const sendEmailPostmark = async (emailAddresses, apiKey, data) => {
  console.log("sendEmailPostmark", emailAddresses, data);
  const url = "https://api.postmarkapp.com/email";
  const body = {
    From: emailAddresses[0],
    To: emailAddresses.join(","),    
    Subject: "Someone Wants to Partner with Storm Cloud Development",
    HtmlBody: `New form submission received from stormclouddevelopment.com:<br/>
    <strong>Name:</strong> ${data.name}<br/>
    <strong>Email:</strong> ${data.email}<br/>
    <strong>Message:</strong> ${data.message}<br/>
    `,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json();
    console.error(error);
    throw new Error("Failed to send email via Postmark");
  }
  console.log(response);
};

const saveToKV = async (STORE, data) => {  
  const key = `${new Date().toISOString().split("T")[0]}-${data.email}`;
    await STORE.put(key, JSON.stringify(data));
};

const handlePromise = (promise) => {
  return promise
    .then((result) => ({ success: true, result }))
    .catch((error) => {
      console.error(error);
      return { success: false, error }
    });
};

export const onRequestPost = async (context) => {
  const request = context.request;
  const { STORE, POSTMARK_API_KEY } = context.env;

  try {
    const data = await request.json();

    let emailAddresses = ["sacha@stormclouddevelopment.com"];

    const EMAILS = context.env.EMAIL_ADDRESSES.trim().split(",").map(e => e.trim());
    console.log("EMAIL_ADDRESSES raw:", context.env.EMAIL_ADDRESSES);
    console.log("Parsed EMAILS:", EMAILS);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = EMAILS.filter(email => !emailRegex.test(email));
    console.log("Invalid emails:", invalidEmails);

    // ✅ use EMAILS only if all are valid and non-empty
    if (invalidEmails.length === 0 && EMAILS.length > 0) {
      emailAddresses = EMAILS;
    }

    console.log("Final emailAddresses used:", emailAddresses);

    const results = await Promise.all([      
      handlePromise(sendEmailPostmark(emailAddresses, POSTMARK_API_KEY, data)),
      handlePromise(saveToKV(STORE, data)),
    ]); 

    const errors = results.filter((r) => !r.success).map((r) =>
      r.error.message
    );
    if (errors.length > 0) {
      console.error("Failed tasks:", JSON.stringify(errors));
      return new Response(JSON.stringify({ errors }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Form data received and processed", {
      status: 201,
    });
  } catch (error) {
    console.error("Critical failure:", error);
    return new Response("Error processing form data", { status: 500 });
  }
};
