import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectToDatabase from "../database/mongodb.js";
import Employer from "../schemas/employer.schema.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../config/env.js";

const DEFAULT_ADMIN = {
  username: "admin1",
  firstname: "Admin",
  lastname: "Employer",
  email: ADMIN_EMAIL,
  companyname: "Talent Scout",
  // we'll replace this with a hashed password below
  password: ADMIN_PASSWORD,
  role: "admin",
};

async function seed() {
  await connectToDatabase();

  const existingAdmin = await Employer.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log("Admin already exists: ", existingAdmin.email, " skipping seeding.");
    await mongoose.disconnect();
    return;
  }

  // hash admin password explicitly
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await Employer.create({
    ...DEFAULT_ADMIN,
    password: hashedPassword,
  });

  console.log("Admin created:", admin.email);
  console.log("Change your password after login");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed", err);
  process.exit(1);
});