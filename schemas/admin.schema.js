import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employer",
        required: true,
        unique: true
    },
    permissions: {
        type: String,
        enum: [
            "MANAGE_EMPLOYERS",
            "MANAGE_CANDIDATES"
        ],
    }
}, {timestamps: true})

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;