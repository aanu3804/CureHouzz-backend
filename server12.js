require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const fs = require("fs");
const path = require("path");

const authRoutes = require("./routes/auth");

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cors());
app.use(session({ secret: "your_secret", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

/* ===========================================
   ✅ File Paths
=========================================== */
const usersFile = path.join(__dirname, "./data/users.json");
const appointmentFile = path.join(__dirname, "./data/AppointmentData.json");
const labBookingsFile = path.join(__dirname, "./data/LabBookings.json");
const DATA_FILE = path.join(__dirname, "./data/MedicineBooking.json");

/* ===========================================
   ✅ Utility Functions (JSON Handling)
=========================================== */
const readJSONFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, "utf8").trim();
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`❌ Error reading ${filePath}:`, error.message);
        return [];
    }
};

const writeJSONFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`❌ Error writing to ${filePath}:`, error.message);
    }
};

/* ===========================================
   ✅ Appointment Handling
=========================================== */
const getAppointments = () => readJSONFile(appointmentFile);
const saveAppointments = (appointments) => writeJSONFile(appointmentFile, appointments);

app.post("/save-appointment", (req, res) => {
    try {
        const { doctorName, specialization, hospital, date, time, fee, patientName, email, phone } = req.body;
        if (!doctorName || !specialization || !hospital || !date || !time || !fee || !patientName || !email || !phone) {
            return res.status(400).json({ error: "All fields are required!" });
        }

        console.log("🟢 Appointment Received:", req.body);
        const appointments = getAppointments();
        const newAppointment = { doctorName, specialization, hospital, date, time, fee, patientName, email, phone };
        appointments.push(newAppointment);
        saveAppointments(appointments);

        res.status(201).json({ message: "✅ Appointment saved successfully!", appointment: newAppointment });
    } catch (error) {
        console.error("❌ Error saving appointment:", error.message);
        res.status(500).send("❌ Error saving appointment");
    }
});

app.get("/appointments", (req, res) => {
    try {
        res.status(200).json(getAppointments());
    } catch (error) {
        console.error("❌ Error fetching appointments:", error.message);
        res.status(500).json({ error: "Error fetching appointments" });
    }
});

/* ===========================================
   ✅ Lab Bookings Handling
=========================================== */
const getLabBookings = () => readJSONFile(labBookingsFile);
const saveLabBookings = (bookings) => writeJSONFile(labBookingsFile, bookings);

app.post("/save-lab-booking", (req, res) => {
    try {
        const { name, email,phone, service, lab, date, time } = req.body;
        if (!name || !email || !service ||!phone || !lab || !date || !time) {
            return res.status(400).json({ error: "All fields are required!" });
        }

        console.log("🟢 Lab Booking Received:", req.body);
        const labBookings = getLabBookings();
        const newBooking = { name, email,phone, service, lab, date, time };
        labBookings.push(newBooking);
        saveLabBookings(labBookings);

        res.status(201).json({ message: "✅ Lab booking saved successfully!", booking: newBooking });
    } catch (error) {
        console.error("❌ Error saving lab booking:", error.message);
        res.status(500).send("❌ Error saving lab booking");
    }
});

app.get("/lab", (req, res) => {
    try {
        res.json(getLabBookings());
    } catch (error) {
        console.error("❌ Error fetching lab bookings:", error.message);
        res.status(500).send("❌ Error fetching lab bookings");
    }
});

app.get("/lab/:email", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        res.json(getLabBookings().filter((lab) => lab.email === email));
    } catch (error) {
        console.error("❌ Error fetching user lab bookings:", error.message);
        res.status(500).send("❌ Error fetching user lab bookings");
    }
});

app.delete("/lab/:email/:date/:time", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const date = decodeURIComponent(req.params.date).replace(/%2C/g, ",");
        const time = decodeURIComponent(req.params.time);
        const updatedLabs = getLabBookings().filter(
            (lab) => lab.email !== email || lab.date !== date || lab.time !== time
        );
        saveLabBookings(updatedLabs);

        res.status(200).send("✅ Lab booking deleted successfully!");
    } catch (error) {
        console.error("❌ Error deleting lab booking:", error.message);
        res.status(500).send("❌ Error deleting lab booking");
    }
});

/* ===========================================
   ✅ Google OAuth Strategy
=========================================== */
const getUsers = () => readJSONFile(usersFile);
const saveUsers = (users) => writeJSONFile(usersFile, users);

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/auth/google/callback",
            scope: ["profile", "email"],
        },
        (accessToken, refreshToken, profile, done) => {
            const users = getUsers();
            let user = users.find((u) => u.email === profile.emails[0].value);

            if (!user) {
                user = { name: profile.displayName, email: profile.emails[0].value, photo: profile.photos[0].value, role: "patient", verified: true , gemder: profile.gender, DateofBirth: profile.dob, age: profile.age, phone: profile.phone };
                users.push(user);
                saveUsers(users);
            }

            return done(null, user);
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/* ===========================================
   ✅ API Routes
=========================================== */
app.use("/auth", authRoutes);
app.use("/", authRoutes);

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req, res) => {
        const user = req.user;
        res.redirect(
            `http://localhost:5173/?name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&photo=${encodeURIComponent(user.photo)}`
        );
    }
);

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

/* ===========================================
   ✅ Fetch User-Specific Appointments
=========================================== */
app.get("/appointments/:email", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        res.json(getAppointments().filter((appointment) => appointment.email === email));
    } catch (error) {
        console.error("❌ Error fetching user appointments:", error.message);
        res.status(500).send("❌ Error fetching user appointments");
    }
});

/* ===========================================
   ✅ Delete a Doctor Appointment
=========================================== */
app.delete("/appointments/:email/:date/:time", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const date = decodeURIComponent(req.params.date);
        const time = decodeURIComponent(req.params.time);
        const updatedAppointments = getAppointments().filter(
            (appointment) => appointment.email !== email || appointment.date !== date || appointment.time !== time
        );
        saveAppointments(updatedAppointments);

        res.status(200).send("✅ Appointment deleted successfully!");
    } catch (error) {
        console.error("❌ Error deleting appointment:", error.message);
        res.status(500).send("❌ Error deleting appointment");
    }
});

// Ensure the file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// API to handle medicine booking
app.post("/book-medicine", (req, res) => {
    try {
        const { userName, email, address,phone, medicine, quantity, price, timestamp } = req.body;

        // Validate required fields
        if (!userName || !email || !address || !phone || !medicine || !quantity || !price || !timestamp) {
            return res.status(400).json({ error: "All fields are required!" });
        }

        console.log("🟢 Medicine Order Received:", req.body);

        const bookings = readJSONFile(DATA_FILE);
        const newBooking = { userName, email, address,phone, medicine, quantity, price, timestamp };

        bookings.push(newBooking);
        writeJSONFile(DATA_FILE, bookings);

        res.status(201).json({ message: "✅ Medicine booking successful!", booking: newBooking });
    } catch (error) {
        console.error("❌ Error saving medicine booking:", error.message);
        res.status(500).json({ message: "❌ Server error" });
    }
});

app.get("/book-medicine/:email", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        
        // Read the medicine bookings
        const bookings = readJSONFile(DATA_FILE);

        // Ensure it's an array before filtering
        if (!Array.isArray(bookings)) {
            throw new Error("Invalid data format in MedicineBooking.json");
        }

        const userBookings = bookings.filter((booking) => booking.email === email);
        
        res.status(200).json(userBookings);
    } catch (error) {
        console.error("❌ Error fetching user medicine bookings:", error.message);
        res.status(500).json({ error: "❌ Internal Server Error - Could not fetch medicine bookings" });
    }
});

app.delete("/book-medicine/:email/:medicine", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const medicine = decodeURIComponent(req.params.medicine);

        const updatedBookings = readJSONFile(DATA_FILE).filter(
            (booking) => !(booking.email === email && booking.medicine === medicine)
        );

        writeJSONFile(DATA_FILE, updatedBookings);

        res.status(200).json({ message: "✅ Medicine booking deleted successfully!" });
    } catch (error) {
        console.error("❌ Error deleting medicine booking:", error.message);
        res.status(500).json({ error: "❌ Error deleting medicine booking" });
    }
});

app.put("/update-profile/:email", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const { name, gender, dob, phone } = req.body;

        // Read existing users
        const users = readJSONFile(usersFile);

        // Find user index
        const userIndex = users.findIndex((user) => user.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ error: "User not found!" });
        }

        // Calculate age from dob
        const calculateAge = (dob) => {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            return age;
        };

        // Update user details
        if (name) users[userIndex].name = name;
        if (gender) users[userIndex].gender = gender;
        if (dob) {
            users[userIndex].dob = dob;
            users[userIndex].age = calculateAge(dob);
        }
        if (phone) users[userIndex].phone = phone;

        // Save updated users
        writeJSONFile(usersFile, users);

        // Destroy the session (logs out the user)
        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Error destroying session:", err.message);
                return res.status(500).json({ error: "❌ Server error - Could not log out" });
            }

            // Send response indicating logout and redirect
            res.status(200).json({ message: "✅ Profile updated successfully! Please log in again.", logout: true });
        });
    } catch (error) {
        console.error("❌ Error updating profile:", error.message);
        res.status(500).json({ error: "❌ Server error - Could not update profile" });
    }
});
app.delete("/delete-account/:email", (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);

        // Read and filter users.json
        let users = readJSONFile(usersFile);
        const updatedUsers = users.filter((user) => user.email !== email);
        writeJSONFile(usersFile, updatedUsers);

        // Read and filter AppointmentData.json
        let appointments = readJSONFile(appointmentFile);
        const updatedAppointments = appointments.filter((appointment) => appointment.email !== email);
        writeJSONFile(appointmentFile, updatedAppointments);

        // Read and filter LabBookings.json
        let labBookings = readJSONFile(labBookingsFile);
        const updatedLabBookings = labBookings.filter((lab) => lab.email !== email);
        writeJSONFile(labBookingsFile, updatedLabBookings);

        // Read and filter MedicineBooking.json
        let medicineBookings = readJSONFile(DATA_FILE);
        const updatedMedicineBookings = medicineBookings.filter((booking) => booking.email !== email);
        writeJSONFile(DATA_FILE, updatedMedicineBookings);

        // Destroy session and log out
        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Error destroying session:", err.message);
                return res.status(500).json({ error: "❌ Server error - Could not log out" });
            }

            res.status(200).json({ message: "✅ Account deleted successfully! Redirecting to login page.", logout: true });
        });

    } catch (error) {
        console.error("❌ Error deleting account:", error.message);
        res.status(500).json({ error: "❌ Server error - Could not delete account" });
    }
});
