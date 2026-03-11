/**
 * mergeService.js
 *
 * Merges LinkedIn and CV data into a single unified Candidate profile.
 * Priority rules:
 *  - LinkedIn wins for: fullName, headline, profilePicture, portfolioLinks, recommendations
 *  - CV wins for: location, email, phone, workExperience, education, skills, certifications
 *  - summary: LinkedIn headline used as fallback if CV summary is empty
 *  - Each field falls back gracefully when the primary source is empty
 */

/**
 * @param {object} liData - Data from linkedinService (may be partial)
 * @param {object} cvData - Data from cvService (may be partial)
 * @returns {object} Merged candidate fields ready to save into Mongoose
 */

function mergeProfiles(liData = {}, cvData = {}) {
    // Helper: return first empty value
    const prefer = (...values) => values.find( (v) => v && String(v).trim() !== "") || "";

    return {
        // Identity — LinkedIn takes priority
        fullName: prefer(liData.fullName, cvData.fullName) || "Unknown Candidate",
        headline: prefer(liData.headline, cvData.summary),
        summary: prefer(cvData.summary, liData.headline, liData.summary),
        profilePicture: prefer(
            liData.profilePicture,
            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cvData.fullName || "Unknown")}&backgroundColor=dbeafe`
        ),

        // Contact — CV is the authoritative source
        email: prefer(cvData.email),
        phone: prefer(cvData.phone),
        location: prefer(cvData.location),

        // LinkedIn-specific
        linkedinUrl: prefer(liData.linkedinUrl),
        portfolioLinks: Array.isArray(liData.portfolioLinks)
            ? liData.portfolioLinks
            : [],
        recommendations: liData.recommendations?.length ? liData.recommendations : [],

        // CV-specific structured data
        workExperience: normalizeWorkExperience(cvData.workExperience),
        education: normalizeEducation(cvData.education),
        skills: normalizeSkills(cvData.skills),
        certifications: (cvData.certifications || []).filter(Boolean),

        // Source flags
        sources: {
            linkedin: Boolean(liData.linkedinUrl),
            cv: !!(cvData.fullName || cvData.email || (cvData.workExperience || []).length),
        },

        // Store raw data for auditing
        rawLinkedinData: liData,
        rawCvData: cvData,

        processingStatus: "completed",
        processingError: null,
    };
}

function normalizeWorkExperience(experiences = []) {
    if (!Array.isArray(experiences)) return [];
    return experiences
        .filter((e) => e && (e.title || e.company))
        .map((e) => ({
            title: (e.title || "").trim(),
            company: (e.company || "").trim(),
            location: (e.location || "").trim(),
            startDate: (e.startDate || "").trim(),
            endDate: (e.endDate || "").trim(),
            duration: (e.duration || "").trim(),
            description: (e.description || "").trim(),
            current: Boolean(e.current),
        }));
}

function normalizeEducation(education = []) {
    if (!Array.isArray(education)) return [];
    return education
        .filter((e) => e && (e.degree || e.institution))
        .map((e) => ({
            degree: (e.degree || "").trim(),
            field: (e.field || "").trim(),
            institution: (e.institution || "").trim(),
            year: (e.year || "").trim(),
            grade: (e.grade || "").trim(),
        }));
}

function normalizeSkills(skills = []) {
    if (!Array.isArray(skills)) return [];
    // Deduplicate, trim, filter empties
    const seen = new Set();
    return skills
        .map((s) => String(s).trim())
        .filter((s) => {
            if (!s || seen.has(s.toLowerCase())) return false;
            seen.add(s.toLowerCase());
            return true;
        });
}

export {mergeProfiles};