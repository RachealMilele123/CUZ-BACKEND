// Login route for users and admins
const express = require("express");
const router = express.Router();
const bankControllers = require("../controllers/bankControllers");

router.post("/login", bankControllers.login);
router.post("/register", bankControllers.register);
router.post("/approve", bankControllers.approveUser);
router.post("/deposit", bankControllers.deposit);
router.post("/transfer", bankControllers.transfer);
router.get("/transactions/:accountNumber", bankControllers.transactions);

module.exports = router;
