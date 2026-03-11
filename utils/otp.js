export function generateOTP() {
    // guarantees a 6-digit string between "100000" and "999999"
    const otp = Math.floor(100000 + Math.random() * 900000);
    return String(otp).padStart(6, '0');
}