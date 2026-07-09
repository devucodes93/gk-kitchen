const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const {
  getDashboard,
  getCustomers,
  getCustomer,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  getRestaurant,
  updateRestaurant,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateProfile,
} = require("../controller/adminController");

router.use(protect, role("admin"));

router.get("/dashboard", getDashboard);
router.get("/customers", getCustomers);
router.get("/customers/:id", getCustomer);
router.get("/offers", getOffers);
router.post("/offers", createOffer);
router.put("/offers/:id", updateOffer);
router.delete("/offers/:id", deleteOffer);
router.get("/restaurant", getRestaurant);
router.put("/restaurant", updateRestaurant);
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);
router.patch("/profile", updateProfile);

module.exports = router;
