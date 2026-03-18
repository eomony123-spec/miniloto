const { isAuthenticated } = require("./_auth");
const { json } = require("./_response");

const CSV_URL = "https://www.japannetbank.co.jp/lottery/co/minilotojnb.csv";

exports.handler = async (event) => {
  if (!isAuthenticated(event.headers)) {
    return json(401, { error: "認証が必要です。" });
  }

  const upstream = await fetch(CSV_URL, {
    headers: {
      "User-Agent": "WarukunNetlifyFunction/1.0",
      Accept: "text/csv,*/*;q=0.8",
    },
  });

  if (!upstream.ok) {
    return json(502, { error: `CSV取得に失敗しました (${upstream.status})` });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const decoder = new TextDecoder("shift-jis");
  const csvText = decoder.decode(buffer);

  return json(200, {
    sourceUrl: CSV_URL,
    fetchedAt: new Date().toISOString(),
    csvText,
  });
};
