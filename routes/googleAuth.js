// firebase-google-auth.js (Firebase version of Google signup/login logic)
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("./firebase");
const router = express.Router();

// Function to handle Google signup and login
async function googleSignupHandler(googleData) {
  const { name, email, photo, role, gender } = googleData;
  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("email", "==", email).get();

  if (!snapshot.empty) {
    const existingUser = snapshot.docs[0].data();
    return { user: existingUser, newSignup: false };
  } else {
    const generatedPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const newUser = {
      name,
      email,
      photo,
      role,
      gender,
      password: hashedPassword,
      verified: true,
    };

    await usersRef.add(newUser);

    return { user: newUser, newSignup: true, generatedPassword };
  }
}

// Google login/signup route
router.post("/google", async (req, res) => {
  const googleData = req.body;

  try {
    const { user, newSignup, generatedPassword } = await googleSignupHandler(googleData);

    if (newSignup) {
      return res.json({
        message: "User created successfully with Google.",
        user,
        generatedPassword,
      });
    } else {
      return res.json({
        message: "Welcome back!",
        user,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during Google login/signup" });
  }
});

module.exports = router;
