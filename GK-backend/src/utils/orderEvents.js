const jwt = require("jsonwebtoken");

const clients = new Set();

const sendEvent = (res, type, payload) => {
  try {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // The close handler removes dead clients; ignore write races.
  }
};

const broadcastOrderEvent = (type, order) => {
  for (const client of clients) {
    sendEvent(client.res, type, { order });
  }
};

const orderEvents = (req, res) => {
  const token = req.query.token;

  try {
    if (!token) throw new Error("Missing token");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!["admin", "rider"].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 10000\n\n");

  const client = { res };
  clients.add(client);
  sendEvent(res, "connected", { ok: true });

  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(client);
  });
};

module.exports = { broadcastOrderEvent, orderEvents };
