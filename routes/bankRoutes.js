// Login route for users and admins
const express = require("express");
const router = express.Router();

const bankControllers = require("../controllers/bankControllers");
const authControllers = require("../controllers/authControllers");
const registerController = require("../controllers/registerController");

router.post("/login", authControllers.login);
router.post("/register", registerController.register);
router.post("/forgot-password", authControllers.forgotPassword);
router.post("/reset-password/:token", authControllers.resetPassword);
router.post("/approve", bankControllers.approveUser);
router.post("/deposit", bankControllers.deposit);
router.post("/transfer", bankControllers.transfer);
router.get("/transactions/:accountNumber", bankControllers.transactions);
router.get("/balance", bankControllers.getUserBalance);
router.get("/my-transfers", bankControllers.getMyTransfers);

// Beneficiary routes
router.post("/beneficiaries", bankControllers.addBeneficiary);
router.get("/beneficiaries", bankControllers.getBeneficiaries);
router.post("/transfer-to-beneficiary", bankControllers.transferToBeneficiary);
router.delete(
  "/beneficiaries/:beneficiaryId",
  bankControllers.removeBeneficiary
);

module.exports = router;
