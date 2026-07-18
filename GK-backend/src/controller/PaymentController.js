const crypto = require("crypto");
const Razorpay = require("razorpay");
// Your existing pg Pool from db.js — adjust the path if it lives somewhere
// other than one level up.
const pool = require("../config/db");

const getRazorpay = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured.");
  }
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to start payment.",
      });
    }

    const { amount, currency = "INR", receipt, notes } = req.body;
    const amountValue = Number(amount ?? req.body.total_price ?? req.body.totalPrice);

    if (!amountValue || amountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid payment amount is required.",
      });
    }

    const razorpay = getRazorpay();
    const paymentOrder = await razorpay.orders.create({
      amount: Math.round(amountValue * 100),
      currency,
      receipt: receipt || `order_rcptid_${Date.now()}`,
      payment_capture: 1,
      notes: {
        user_id: userId,
        ...((typeof notes === "object" && notes !== null) ? notes : {}),
      },
    });

    res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      data: {
        ...paymentOrder,
        // The frontend needs the *public* key id to open Razorpay Checkout.
        // Never send RAZORPAY_KEY_SECRET here.
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (err) {
    console.error("createPaymentOrder error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to create payment order.",
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      phone_number,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification fields.",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay configuration missing on server.",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    // Signature checks out — the payment is genuinely successful. Save it
    // now, independent of whatever happens next (e.g. the food-order
    // record failing to save afterward): this row is the source of truth
    // that the customer was charged and can be reconciled against later.
    const amountValue = Number(amount);
    let savedPayment = null;

    try {
      const insertResult = await pool.query(
        `insert into payments
           (razorpay_order_id, razorpay_payment_id, amount, phone_number, user_id, status)
         values ($1, $2, $3, $4, $5, 'success')
         on conflict (razorpay_payment_id) do nothing
         returning *`,
        [
          razorpay_order_id,
          razorpay_payment_id,
          Number.isFinite(amountValue) ? amountValue : null,
          phone_number || null,
          req.user?.id || null,
        ],
      );

      savedPayment = insertResult.rows[0] || null;

      if (!savedPayment) {
        // ON CONFLICT DO NOTHING returns no row when this payment_id was
        // already saved (e.g. the frontend retried the verify call) — that
        // isn't an error, just fetch the row that's already there.
        const existing = await pool.query(
          "select * from payments where razorpay_payment_id = $1",
          [razorpay_payment_id],
        );
        savedPayment = existing.rows[0] || null;
      }
    } catch (insertError) {
      // The payment itself is still valid and verified — don't fail the
      // whole request over a DB write problem, just log it for follow-up.
      console.error("Failed to save payment record:", insertError);
    }

    res.json({
      success: true,
      message: "Payment verified successfully.",
      data: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment: savedPayment,
      },
    });
  } catch (err) {
    console.error("verifyPayment error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to verify payment.",
    });
  }
};

// ---------------------------------------------------------------------------
// Webhook — Razorpay calls this server-to-server whenever a payment event
// happens, independent of whether the customer's browser is even still
// open. This is the durable source of truth: the frontend's /verify call
// covers the common case (customer waits for confirmation), this covers
// the edge cases (tab closed mid-payment, network dropped after paying,
// app crashed, etc) that /verify would otherwise miss entirely.
//
// IMPORTANT: req.body here must be the raw, unparsed request Buffer —
// Razorpay signs the exact raw bytes it sent, so if a JSON body-parser
// has already run on this route, the signature check below will always
// fail. See the mounting instructions where this is wired into server.js.
// ---------------------------------------------------------------------------
const handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured.");
      return res.status(500).send("Webhook not configured");
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).send("Missing signature");
    }

    const rawBody = req.body; // Buffer — see the note above.
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("Razorpay webhook signature mismatch — ignoring.");
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const payment = event?.payload?.payment?.entity;

    // Only these two matter for keeping `payments` accurate. Anything else
    // (order.paid, refund events, etc) is safely ignored for now — add a
    // case here if you start needing them.
    if (payment && (event.event === "payment.captured" || event.event === "payment.failed")) {
      const status = event.event === "payment.captured" ? "success" : "failed";

      await pool.query(
        `insert into payments
           (razorpay_order_id, razorpay_payment_id, amount, phone_number, user_id, status)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (razorpay_payment_id)
         do update set status = excluded.status`,
        [
          payment.order_id,
          payment.id,
          Number.isFinite(payment.amount) ? payment.amount / 100 : null,
          payment.contact || null,
          payment.notes?.user_id || null,
          status,
        ],
      );
    }

    // Razorpay just needs a fast 2xx to know the event was received —
    // it retries with backoff on anything else, which we want if our own
    // handling above throws.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("handleWebhook error:", err);
    res.status(500).send("Webhook handler error");
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
};