import mongoose from "mongoose";

// Sub schemas
const workExperienceSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    location: {
        type: String,
        trim: true
    },
    startDate: {
        type: String,
        trim: true
    },
    endDate: {
        type: String,
        trim: true
    },
    duration: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    current: {
        type: Boolean,
        default: false
    },
}, {_id: true});
const educationSchema = new mongoose.Schema({
    degree: {
        type: String,
        trim: true
    },
    field: {
        type: String,
        trim: true
    },
    institution: {
        type: String,
        trim: true
    },
    year: {
        type: String,
        trim: true
    },
    grade: {
        type: String,
        trim: true
    },
}, { _id: true });

const recommendationSchema = new mongoose.Schema({
    author: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        trim: true
    },
    text: {
        type: String,
        trim: true
    },
}, { _id: true });

const uploadedFileSchema = new mongoose.Schema({
    originalName: {
        type: String
    },
    storedName: {
        type: String
    },
    mimeType: {
        type: String
    },
    sizeBytes: {
        type: Number
    },
    path: {
        type: String
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
}, { _id: true });

// Main candidate schema
const candidateSchema = new mongoose.Schema({
    // Ownership
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employer",
        required: [true, "Candidate must belong to an employer."],
        index: true,
    },
    // Identity
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    headline: {
        type: String,
        trim: true,
        default: ""
    },
    summary: {
        type: String,
        trim: true,
        default: ""
    },
    profilePicture: {
        type: String,
        default: ""
    },

    // Contact
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ""
    },
    phone: {
        type: String,
        trim: true,
        default: ""
    },
    location: {
        type: String,
        trim: true,
        default: ""
    },

    // LinkedIn
    linkedinUrl: {
        type: String,
        trim: true,
        default: ""
    },
    portfolioLinks: {
        type: [String],
        default: []
    },
    recommendations: {
        type: [recommendationSchema],
        default: []
    },

    // Structured data
    workExperience: {
        type: [workExperienceSchema],
        default: []
    },
    education: {
        type: [educationSchema],
        default: []
    },
    skills: {
        type: [String],
        default: []
    },
    certifications: {
        type: [String],
        default: []
    },

    // File reference
    uploadedFile: {
        type: uploadedFileSchema,
        default: null
    },
    // Processing metadata
    processingStatus: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
        index: true,
    },
    processingError: {
        type: String,
        default: null
    },
    jobId: {
        type: String,
        default: null
    },

    // Source tracking
    sources: {
        linkedin: {
            type: Boolean,
            default: false
        },
        cv: {
            type: Boolean,
            default: false
        },
    },

    // Raw extractions (for auditing/debugging)
    rawLinkedinData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    rawCvData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtuals
candidateSchema.virtual("primarySkill").get(function () {
    return this.skills?.[0] || "";
});

candidateSchema.virtual("isReady").get(function () {
    return this.processingStatus === "completed";
});

// Indexes
candidateSchema.index({ fullName: "text", headline: "text", skills: "text" });
candidateSchema.index({ createdAt: -1 });
candidateSchema.index({employerId: 1, createdAt: -1})

// Static methods

candidateSchema.statics.search = function (query) {
    return this.find({ $text: { $search: query } }, { score: { $meta: "textScore" } }).sort({
        score: { $meta: "textScore" },
    });
};

const Candidate = mongoose.model("Candidate", candidateSchema);

export default Candidate;