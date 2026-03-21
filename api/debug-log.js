module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  console.log("[DEBUG MOBILE]", JSON.stringify(req.body));
  return res.json({ ok: true });
};
 