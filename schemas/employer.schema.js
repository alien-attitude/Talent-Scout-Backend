import mongoose from "mongoose";

/**
 * Employer model
 *
 * Role logic:
 *   "employer" — can add and view only their own candidates
 *   "admin" — is also an employer but can see everything
 *
 * Every admin IS an employer. Not every employer IS an admin.
 * We express this with a single `role` field — no separate Admin collection needed.
 */

const employerSchema = new mongoose.Schema({
    username:{
        type: String,
        required: [true, "Username is required"],
        lowercase: true,
        unique: true,
        trim:true,
        minlength: [3, "Username must be at least 3 characters long"],
        maxlength: [20, "Username must be at most 20 characters long"]
    },
    firstname:{
        type: String,
        required: [true, "Firstname is required"],
        trim:true,
        minlength: [3, "Firstname must be at least 3 characters long"],
        maxlength: [30, "Firstname must be at most 30 characters long"]
    },
    lastname:{
        type: String,
        required: [true, "Lastname is required"],
        trim:true,
        minlength: [3, "Lastname must be at least 3 characters long"],
        maxlength: [30, "Lastname must be at most 30 characters long"]
    },
    companyname:{
        type: String,
        required: [true, "Company name is required"],
        trim:true,
        minlength: [3, "Company name must be at least 3 characters long"],
        maxlength: [30, "Company name must be at most 30 characters long"]
    },
    email:{
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim:true,
        lowercase:true,
        match: [/\S+@\S+\.\S+/, 'Please enter a valid email address']
    },
    role:{
        type: String,
        enum: ["employer", "admin"],
        default: "employer"
    },
    password:{
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters long"],
        select: false
    },
    isActive:{
        type: Boolean,
        default: true
    },
    resetPasswordOtp: {
        type:    String,
        select:  false,
        default: null,
    },
    resetPasswordOtpExpires: {
        type:    Date,
        select:  false,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

employerSchema.virtual("isAdmin").get(function () {
    return this.role === "admin";
});

employerSchema.index({
    role: 1
});

const Employer = mongoose.model("Employer", employerSchema);

export default Employer