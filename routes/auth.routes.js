import  {Router} from 'express'
import {signUp, logIn, logOut, refreshToken,
resetPassword, forgotPassword, getMe, verifyOtp} from "../controllers/auth.controller.js";
import { validateSignUp, validateLogin,
validateForgotPassword, validateResetPassword} from "../middlewares/validators.js"
import {authenticate} from "../middlewares/auth.middleware.js";

const authRoutes = Router()

authRoutes.post('/signup', validateSignUp, signUp)
authRoutes.post('/login', validateLogin, logIn )
authRoutes.post('/refresh', refreshToken)
authRoutes.post('/logout', logOut)
authRoutes.post('/forgot-password', validateForgotPassword, forgotPassword)
authRoutes.post('/reset-password', validateResetPassword, resetPassword)
authRoutes.post('/verify-otp', verifyOtp)

authRoutes.get("/me", authenticate, getMe);

export default authRoutes;