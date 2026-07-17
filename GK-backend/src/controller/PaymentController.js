const crypto = require("crypto");
const Razorpay = require("razorpay");

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
      data: paymentOrder,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
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

    res.json({
      success: true,
      message: "Payment verified successfully.",
      data: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
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

module.exports = {
  createPaymentOrder,
  verifyPayment,
};
