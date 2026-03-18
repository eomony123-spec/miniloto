const { buildClearedSessionCookie } = require("./_auth");
const { json } = require("./_response");

exports.handler = async () => {
  return json(
    200,
    { ok: true },
    {
      "Set-Cookie": buildClearedSessionCookie(),
    }
  );
};
