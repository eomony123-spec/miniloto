const { buildSessionCookie, getPassword } = require("./_auth");
const { json } = require("./_response");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method Not Allowed" });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, error: "不正なリクエストです。" });
  }

  if (payload.password !== getPassword()) {
    return json(401, { ok: false, error: "パスワードが違います。" });
  }

  return json(
    200,
    { ok: true },
    {
      "Set-Cookie": buildSessionCookie(),
    }
  );
};
