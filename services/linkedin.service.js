const MOCK_PROFILES = [
    {
        fullName: "Jordan Ellis",
        headline: "Engineering Lead · React · Node.js · AWS · Building scalable systems",
        summary:
            "Experienced engineering leader with 10+ years building high-traffic web platforms. Passionate about developer experience and system design.",
        portfolioLinks: ["https://github.com/jordan-ellis", "https://jordanellis.io"],
        recommendations: [
            {
                author: "Rachel Kim",
                role: "VP Engineering at TechFlow",
                text: "Jordan's technical depth and collaborative mindset made a measurable impact on our team's velocity and output quality.",
            },
        ],
    },
    {
        fullName: "Priya Mehta",
        headline: "Senior Product Manager · B2B SaaS · Growth Strategy · Agile",
        summary:
            "Product leader focused on turning user insights into shipped features. Led 0→1 launches across fintech and edtech verticals.",
        portfolioLinks: ["https://priyamehta.notion.site", "https://github.com/priya-mehta"],
        recommendations: [
            {
                author: "David Osei",
                role: "CTO at BuildBase",
                text: "Priya consistently delivers innovative solutions under pressure — a rare combination of strategic thinking and hands-on execution.",
            },
        ],
    },
    {
        fullName: "Marcus Reeves",
        headline: "Full Stack Engineer · TypeScript · Python · Docker · Open Source",
        summary:
            "Full-stack engineer with a passion for clean APIs and observable systems. Maintainer of several open-source projects.",
        portfolioLinks: ["https://github.com/marcus-reeves", "https://marcusreeves.dev"],
        recommendations: [
            {
                author: "Aisha Nwosu",
                role: "Head of Platform at Stackly",
                text: "Marcus ships clean, maintainable code and brings a contagious energy to every team he joins.",
            },
        ],
    },
    {
        fullName: "Camille Laurent",
        headline: "Data Scientist · ML Engineer · PyTorch · NLP Research",
        summary:
            "Applied ML researcher with industry experience in NLP, recommendation systems, and large-scale data pipelines.",
        portfolioLinks: ["https://github.com/camille-laurent", "https://huggingface.co/camille-l"],
        recommendations: [],
    },
    {
        fullName: "Aiden Park",
        headline: "UX Lead · Design Systems · Figma · User Research · Accessibility",
        summary:
            "Design lead with a background in cognitive psychology. Builds design systems used by thousands of developers.",
        portfolioLinks: ["https://aidenpark.design", "https://dribbble.com/aiden-park"],
        recommendations: [],
    },
];

/**
 * Deterministically pick a mock profile from the LinkedIn slug.
 * Replace this entire function with a real API call in production.
 *
 * @param {string} url - LinkedIn profile URL
 * @returns {object} Normalized LinkedIn profile data
 */
export async function fetchLinkedInProfile(url) {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 600));

    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    const slug = (match ? match[1] : "candidate").toLowerCase().replace(/-/g, "");
    const hash = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const profile = MOCK_PROFILES[hash % MOCK_PROFILES.length];

    return {
        fullName: profile.fullName,
        headline: profile.headline,
        summary: profile.summary,
        // Deterministic avatar from DiceBear
        profilePicture: `https://api.dicebear.com/9.x/avataaars/svg?seed=${slug}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
        portfolioLinks: profile.portfolioLinks,
        recommendations: profile.recommendations,
        linkedinUrl: url,
    };
}
