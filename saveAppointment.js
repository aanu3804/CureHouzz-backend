// firebase-saveAppointment.js (Firebase version of saving appointment)
const db = require("./firebase");

async function saveAppointment(newAppointment) {
  try {
    await db.collection("appointments").add(newAppointment);
    console.log("✅ Appointment saved successfully to Firebase!");
  } catch (error) {
    console.error("❌ Error saving appointment to Firebase:", error.message);
  }
}

const exampleAppointment = {
  service: "MRI Scan",
  lab: "MediCore Pharmaceuticals",
  date: "4 March, 2025",
  time: "10:00 AM",
  patient: "John Doe"
};

// Uncomment to test
// saveAppointment(exampleAppointment);

module.exports = saveAppointment;