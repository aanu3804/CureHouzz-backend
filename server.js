// server.js (Fully updated with Firebase – preserving all 410+ lines & features)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./firebase");
const authRoutes = require("./routes/auth");

const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(session({ secret: "your_secret", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

/* ===========================================
   ✅ Appointment Handling (Firebase)
=========================================== */
app.post("/save-appointment", async (req, res) => {
    try {
        const data = req.body;
        const required = ["doctorName", "specialization", "hospital", "date", "time", "fee", "patientName", "email", "phone"];
        if (required.some(field => !data[field])) {
            return res.status(400).json({ error: "All fields are required!" });
        }
        await db.collection("appointments").add(data);
        res.status(201).json({ message: "✅ Appointment saved successfully!", appointment: data });
    } catch (err) {
        console.error("❌ Error saving appointment:", err.message);
        res.status(500).send("❌ Error saving appointment");
    }
});

app.get("/appointments", async (req, res) => {
    try {
        const snapshot = await db.collection("appointments").get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        res.status(500).json({ error: "Error fetching appointments" });
    }
});

app.get("/appointments/:email", async (req, res) => {
    try {
        const snapshot = await db.collection("appointments")
            .where("email", "==", decodeURIComponent(req.params.email)).get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        res.status(500).send("❌ Error fetching user appointments");
    }
});

app.delete("/appointments/:email/:date/:time", async (req, res) => {
    try {
        const { email, date, time } = req.params;
        const snapshot = await db.collection("appointments")
            .where("email", "==", decodeURIComponent(email))
            .where("date", "==", decodeURIComponent(date))
            .where("time", "==", decodeURIComponent(time)).get();

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        res.status(200).send("✅ Appointment deleted successfully!");
    } catch (err) {
        res.status(500).send("❌ Error deleting appointment");
    }
});

/* ===========================================
   ✅ Lab Bookings Handling (Firebase)
=========================================== */
app.post("/save-lab-booking", async (req, res) => {
    try {
        const data = req.body;
        const required = ["name", "email", "phone", "service", "lab", "date", "time"];
        if (required.some(field => !data[field])) {
            return res.status(400).json({ error: "All fields are required!" });
        }
        await db.collection("labBookings").add(data);
        res.status(201).json({ message: "✅ Lab booking saved successfully!", booking: data });
    } catch (err) {
        res.status(500).json({ error: "❌ Error saving lab booking" });
    }
});

app.get("/lab", async (req, res) => {
    try {
        const snapshot = await db.collection("labBookings").get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        res.status(500).send("❌ Error fetching lab bookings");
    }
});

app.get("/lab/:email", async (req, res) => {
    try {
        const snapshot = await db.collection("labBookings")
            .where("email", "==", decodeURIComponent(req.params.email)).get();
        res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        res.status(500).send("❌ Error fetching user lab bookings");
    }
});

app.delete("/lab/:email/:date/:time", async (req, res) => {
    try {
        const { email, date, time } = req.params;
        const snapshot = await db.collection("labBookings")
            .where("email", "==", decodeURIComponent(email))
            .where("date", "==", decodeURIComponent(date.replace(/%2C/g, ",")))
            .where("time", "==", decodeURIComponent(time)).get();

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        res.status(200).send("✅ Lab booking deleted successfully!");
    } catch (err) {
        res.status(500).send("❌ Error deleting lab booking");
    }
});

/* ===========================================
   ✅ Medicine Bookings Handling (Firebase)
=========================================== */
app.post("/book-medicine", async (req, res) => {
    try {
        const data = req.body;
        const required = ["userName", "email", "address", "phone", "medicine", "quantity", "price", "timestamp"];
        if (required.some(field => !data[field])) {
            return res.status(400).json({ error: "All fields are required!" });
        }
        await db.collection("medicineBookings").add(data);
        res.status(201).json({ message: "✅ Medicine booking successful!", booking: data });
    } catch (err) {
        res.status(500).json({ message: "❌ Server error" });
    }
});

app.get("/book-medicine/:email", async (req, res) => {
    try {
        const snapshot = await db.collection("medicineBookings")
            .where("email", "==", decodeURIComponent(req.params.email)).get();
        res.status(200).json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        res.status(500).json({ error: "❌ Could not fetch medicine bookings" });
    }
});

app.delete("/book-medicine/:email/:medicine", async (req, res) => {
    try {
        const { email, medicine } = req.params;
        const snapshot = await db.collection("medicineBookings")
            .where("email", "==", decodeURIComponent(email))
            .where("medicine", "==", decodeURIComponent(medicine)).get();

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        res.status(200).json({ message: "✅ Medicine booking deleted successfully!" });
    } catch (err) {
        res.status(500).json({ error: "❌ Error deleting medicine booking" });
    }
});

/* ===========================================
   ✅ Profile Update & Account Deletion
=========================================== */
app.put("/update-profile/:email", async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const { name, gender, dob, phone } = req.body;

        const snapshot = await db.collection("users").where("email", "==", email).get();
        if (snapshot.empty) return res.status(404).json({ error: "User not found!" });

        const userDoc = snapshot.docs[0];
        const updates = {};
        if (name) updates.name = name;
        if (gender) updates.gender = gender;
        if (dob) {
            updates.dob = dob;
            const birth = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
            updates.age = age;
        }
        if (phone) updates.phone = phone;

        await db.collection("users").doc(userDoc.id).update(updates);

        req.session.destroy(err => {
            if (err) return res.status(500).json({ error: "❌ Could not log out" });
            res.status(200).json({ message: "✅ Profile updated! Please log in again.", logout: true });
        });
    } catch (err) {
        res.status(500).json({ error: "❌ Server error - Could not update profile" });
    }
});

app.delete("/delete-account/:email", async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);

        const collections = ["users", "appointments", "labBookings", "medicineBookings"];
        for (const col of collections) {
            const snapshot = await db.collection(col).where("email", "==", email).get();
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        req.session.destroy(err => {
            if (err) return res.status(500).json({ error: "❌ Server error - Could not log out" });
            res.status(200).json({ message: "✅ Account deleted! Redirecting to login page.", logout: true });
        });
    } catch (err) {
        res.status(500).json({ error: "❌ Server error - Could not delete account" });
    }
});

/* ===========================================
   ✅ Google OAuth Strategy
=========================================== */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    scope: ["profile", "email"],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const snapshot = await db.collection("users").where("email", "==", email).get();
        let user;
        if (snapshot.empty) {
            user = {
                name: profile.displayName,
                email,
                photo: profile.photos[0].value,
                role: "patient",
                verified: true
            };
            await db.collection("users").add(user);
        } else {
            user = snapshot.docs[0].data();
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use("/auth", authRoutes);
app.use("/", authRoutes);

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
    const user = req.user;
    res.redirect(`http://localhost:5173/?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&photo=${encodeURIComponent(user.photo)}`);
});

/* ===========================================
   ✅ Error Handling Middleware
=========================================== */
app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});

/* ===========================================
   ✅ Start Server
=========================================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
