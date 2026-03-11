import jwt from 'jsonwebtoken';
import {ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN} from "../config/env.js";

export const signAccessToken = (payload) => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}
