import mongoose from "mongoose";
import Employer from "../schemas/employer.schema.js";
import bcrypt from "bcrypt";
import {signAccessToken, signRefreshToken} from "../utils/token.js";
import jwt from "jsonwebtoken";
import { generateOTP } from "../utils/otp.js";


export const signUp = async (req, res, next) => {
    const session = await mongoose.startSession();

    try{
        await session.withTransaction(async () => {
            const {username, firstname, lastname, companyname, email, password, } = req.body;

            if (!email || !password) {
                const error = new Error("Please provide email and password");
                error.statusCode = 400;
                throw error;
            }

            if (password.length < 8) {
                const error = new Error("Password must be at least 8 characters long");
                error.statusCode = 400;
                throw error;
            }

            const existingUser = await Employer.findOne({ email }).session(session);
            if (existingUser) {
                const error = new Error("User already exists");
                error.statusCode = 409;
                throw error;
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            const[newEmployer] = await Employer.create(
                [{
                    username,
                    firstname,
                    lastname,
                    email,
                    companyname,
                    password: hashedPassword,
                }],
                {session}
            );

            const payload = {
                id: newEmployer._id,
            }

            const accessToken = signAccessToken(payload);
            const refreshToken = signRefreshToken(payload);

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000,
            });

            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: false,
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            const safeEmployer = newEmployer.toObject();
            delete safeEmployer.password

            res.status(201).json({
                success: true,
                message: "User created successfully",
                employer: safeEmployer,
                data: {
                    accessToken,
                    refreshToken,
                    user: safeEmployer
                }
            });
        });

    } catch(err){
        next(err);
    } finally {
        await session.endSession();
    }
};

export const logIn = async (req, res, next) => {
    try{
        const {username, email, password} = req.body;

        if (!username && !email || !password) {
            const error = new Error("Please provide username or email and password");
            error.statusCode = 400;
            throw error;
        }
        // Build query depending on what is required
        const query = email ? { email } : { username };

        const employer = await Employer.findOne(query).select('+password');

        // Check if employer is present
        if (!employer) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Validate user password
        const isPasswordValid = await bcrypt.compare(password, employer.password);

        if (!isPasswordValid) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }

        const payload = {
            id: employer._id
        }

        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure:false,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure:false,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24 * 7
        })

        const safeEmployer = employer.toObject();
        delete safeEmployer.password

        res.status(200).json({
            success: true,
            message: 'User logged in successfully',
            data: {
                accessToken,
                refreshToken,
                employer: safeEmployer
            }
        });
    } catch(err){
        next(err);
    }
}

export const logOut = (req, res) => {
    res.clearCookie("accessToken").clearCookie("refreshToken").json({ message: "Logged out successfully" });
}

// Refresh token endpoint
export const refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;

    if (!token) {
        return res.status(401).json({ error: "Access denied. Unauthorized" });
    }

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Refresh token is invalid" });
        }

        const newAccessToken = signAccessToken({ id: decoded.id });

        res.cookie("accessToken", newAccessToken, {
            secure: false,
            httpOnly: true,
            sameSite: "strict",
            maxAge: 1000 * 60 * 60 * 24
        });

        res.status(200).json({
            message: "Access token refreshed successfully",
            accessToken: newAccessToken
        });
    });
};

export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            const error = new Error("Please provide email");
            error.statusCode = 400;
            throw error;
        }

        const employer = await Employer.findOne({ email })

        if (!employer) {
            return res.status(200).json({
                success: true,
                message:
                    "If an account exists with the provided email address, an OTP has been sent",
            });
        }

        const otp = generateOTP();
        const expiresInSeconds = 10;
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        employer.resetPasswordOtp = otp;
        employer.resetPasswordOtpExpires = expiresAt;

        await employer.save()

        // TODO: integrate with your email/SMS service here.

        // for debugging purpose
        console.log(`Password reset OTP for ${employer.email}: ${otp}`);

        return res.status(200).json({
            success: true,
            message: "OTP generated successfully",
            otp: otp,
            email: employer.email,
            expiresInMinutes: expiresInSeconds,
        });
    } catch (error){
        console.error("Error in forgotPassword", error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.message = "Internal server error";
        }
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            const error = new Error("Email, OTP, and new password are required");
            error.statusCode = 400;
            throw error;
        }

        if (newPassword.length < 8) {
            const error = new Error("Password must be at least 8 characters long");
            error.statusCode = 400;
            throw error;
        }

        // otp fields are needed so explicitly select them
        const employer = await Employer.findOne({ email }).select("+resetPasswordOtp +resetPasswordOtpExpires +password");

        if (!employer) {
            const error = new Error("Invalid OTP or expired OTP");
            error.statusCode = 400;
            throw error;
        }

        if (!employer.resetPasswordOtp || !employer.resetPasswordOtpExpires ) {
            const error = new Error("Invalid OTP or expired OTP");
            error.statusCode = 400;
            throw error;
        }

        const now = new Date();

        const isOtpValid =
            employer.resetPasswordOtp === otp && employer.resetPasswordOtpExpires > now;

        if (!isOtpValid) {
            const error = new Error("Invalid OTP or expired");
            error.statusCode = 400;
            throw error;
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        employer.password = hashedPassword;

        // Clear OTP info so it can't be reused
        employer.resetPasswordOtp = undefined;
        employer.resetPasswordExpires = undefined;

        await employer.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successful",
        });
    } catch (error) {
        console.error("Error in resetPassword", error);
        if (!error.statusCode) {
            error.statusCode = 500;
            error.message = "Internal server error";
        }
        next(error);
    }
};

export async function getMe(req, res) {
    // req.employer is already populated by authenticate middleware
    res.json({ employer: req.employer });
}

export const verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            const error = new Error("Email and OTP are required");
            error.statusCode = 400;
            throw error;
        }

        const employer = await Employer.findOne({ email })
            .select("+resetPasswordOtp +resetPasswordOtpExpires");

        // Use same vague error for all failure cases — don't leak info
        const invalidError = new Error("Invalid or expired OTP");
        invalidError.statusCode = 400;

        if (!employer) throw invalidError;
        if (!employer.resetPasswordOtp || !employer.resetPasswordOtpExpires) throw invalidError;

        const now = new Date();
        const isValid =
            employer.resetPasswordOtp === otp &&
            employer.resetPasswordOtpExpires > now;

        if (!isValid) throw invalidError;

        // OTP is valid — don't clear it yet, still needed for resetPassword
        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
        });
    } catch (error) {
        next(error);
    }
};