const express = require("express");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const db = require("../firebase"); // Firestore instance
require("dotenv").config();

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";
const OTP_EXPIRY_TIME = 5 * 60 * 1000;

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASSWORD },
  });
  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP for CareHouzz Verification",
    text: `Your OTP is: ${otp}. It is valid for 5 minutes.`,
  });
};

const getByEmail = async (collectionName, email) => {
  const snapshot = await db.collection(collectionName).where("email", "==", email).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return [doc.id, doc.data()];
};

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, photo, role, gender, dob, age, phone } = req.body;
  if (!firstName || !lastName || !email || !password || !gender || !role || !dob || !age || !phone)
    return res.status(400).json({ message: "All fields are required." });

  const existingUser = await getByEmail("users", email);
  if (existingUser) return res.status(400).json({ message: "Email already exists." });

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

  const newUser = {
    name: `${firstName} ${lastName}`,
    email,
    password: hashedPassword,
    photo: photo || "",
    role,
    gender,
    dob,
    age,
    phone,
    otp,
    otpExpiry,
    verified: false,
  };

  await db.collection("users").add(newUser);

  try {
    await sendOTPEmail(email, otp);
    res.status(201).json({ message: "Signup successful. OTP sent to email.", email });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const found = await getByEmail("users", email);
  if (!found) return res.status(404).json({ message: "User not found." });

  const [userId, user] = found;
  if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });
  if (Date.now() > user.otpExpiry) return res.status(400).json({ message: "OTP expired." });

  await db.collection("users").doc(userId).update({ verified: true, otp: null, otpExpiry: null });
  res.json({ message: "Email verified successfully." });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const found = await getByEmail("users", email);
  if (!found) return res.status(404).json({ message: "User not found." });

  const [, user] = found;
  if (!user.verified) return res.status(403).json({ message: "Please verify your email first." });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

  const token = jwt.sign({ email: user.email, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
  res.json({
    message: "Login successful",
    token,
    user: {
      name: user.name,
      email: user.email,
      photo: user.photo,
      role: user.role,
      gender: user.gender,
      dob: user.dob,
      age: user.age,
      phone: user.phone,
    },
  });
});

router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  const found = await getByEmail("users", email);
  if (!found) return res.status(404).json({ message: "User not found." });

  const [userId] = found;
  const otp = generateOTP();
  const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

  await db.collection("users").doc(userId).update({ otp, otpExpiry });

  try {
    await sendOTPEmail(email, otp);
    res.json({ message: "New OTP sent to email." });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

// ===== DOCTOR =====

router.post("/doctor/signup", async (req, res) => {
  const { firstName, lastName, specialization, hospitalName, dob, phone, email, experience, password } = req.body;
  if (!firstName || !lastName || !specialization || !hospitalName || !dob || !phone || !email || !password)
    return res.status(400).json({ message: "All fields are required." });

  const existingDoctor = await getByEmail("doctors", email);
  if (existingDoctor) return res.status(400).json({ message: "Email already exists." });

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

  const newDoctor = {
    id: uuidv4(),
    firstName,
    lastName,
    specialization,
    hospitalName,
    dob,
    phone,
    email,
    experience,
    password: hashedPassword,
    verified: false,
    otp,
    otpExpiry,
    role: "doctor",
  };

  await db.collection("tempDoctors").add(newDoctor);

  try {
    await sendOTPEmail(email, otp);
    res.status(201).json({ message: "Signup successful. OTP sent to email.", email });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

router.post("/doctor/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const found = await getByEmail("tempDoctors", email);
  if (!found) return res.status(404).json({ message: "Doctor not found." });

  const [tempId, doctor] = found;
  if (doctor.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });
  if (Date.now() > doctor.otpExpiry) return res.status(400).json({ message: "OTP expired." });

  delete doctor.otp;
  delete doctor.otpExpiry;
  doctor.verified = true;
  doctor.createdAt = new Date().toISOString();

  await db.collection("doctors").add(doctor);
  await db.collection("tempDoctors").doc(tempId).delete();

  res.json({ message: "Doctor registered successfully." });
});

router.post("/doctor/login", async (req, res) => {
  const { email, password } = req.body;
  const found = await getByEmail("doctors", email);
  if (!found) return res.status(404).json({ message: "Doctor not found." });

  const [, doctor] = found;
  const isMatch = await bcrypt.compare(password, doctor.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

  const token = jwt.sign({ id: doctor.id, email: doctor.email, role: "doctor" }, SECRET_KEY, { expiresIn: "1h" });
  res.json({
    message: "Login successful",
    token,
    user: {
      id: doctor.id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      specialization: doctor.specialization,
      hospitalName: doctor.hospitalName,
      dob: doctor.dob,
      phone: doctor.phone,
      email: doctor.email,
      experience: doctor.experience,
      createdAt: doctor.createdAt,
      role: "doctor",
    },
  });
});

router.post("/doctor/resend-otp", async (req, res) => {
  const { email } = req.body;
  const found = await getByEmail("tempDoctors", email);
  if (!found) return res.status(404).json({ message: "Doctor not found in pending verifications." });

  const [tempId] = found;
  const otp = generateOTP();
  const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

  await db.collection("tempDoctors").doc(tempId).update({ otp, otpExpiry });

  try {
    await sendOTPEmail(email, otp);
    res.json({ message: "New OTP sent to email." });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP." });
  }
});

router.get("/doctor/dashboard", async (req, res) => {
  const { email } = req.query;
  const found = await getByEmail("doctors", email);
  if (!found) return res.status(404).json({ message: "Doctor not found." });

  res.json({ doctor: found[1] });
});

module.exports = router;
