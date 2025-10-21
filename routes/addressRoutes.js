const express = require("express");
const { addAddress, getAllAddresses } = require("../controllers/addressControllers");

const router = express.Router();

// POST - add new address
router.post("/add", addAddress);

// GET - list all addresses
router.get("/", getAllAddresses);

module.exports = router;
