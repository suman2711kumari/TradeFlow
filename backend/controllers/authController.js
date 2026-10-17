
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Set JWT_SECRET in backend/.env. The fallback preserves compatibility with older local setups.
const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

const ExpressError = require("../utils/ExpressError");
const  {User}  = require("../model/UserModel");

const otpStore = {};

const sendOtp = async(req,res)=>{

   const { phone } = req.body;

   const otp = Math.floor(
      100000 + Math.random() * 900000
   );

   otpStore[phone] = otp;

   console.log("OTP:", otp);

   // send sms here

   res.json({
      success:true,
      message:"OTP sent"
   });
};

const verifyOtp = async(req,res)=>{

   const { phone, otp } = req.body;

   if(otpStore[phone] == otp){

      return res.json({
         success:true,
         message:"OTP verified"
      });
   }

   res.status(400).json({
      success:false,
      message:"Invalid OTP"
   });
};




const registerUser = async(req,res)=>{

   try{

      const { name, phone, password } = req.body;
      const cleanPhone = phone.slice(-10);
      const hashedPassword =
         await bcrypt.hash(password,10);

      const user = await User.create({

         name,

         MobNo: cleanPhone,

         password: hashedPassword
      });

      res.json({
         success:true,
         user
      });

   }
   catch(err){
   console.log(err);

      if (err.code === 11000) {
         return res.status(409).json({
            success: false,
            message: "An account with this phone number already exists"
         });
      }

      res.status(500).json({
         success: false,
         message: "Server error"
      });
   }
};



const login = async (req, res) => {

   const { phone, password } = req.body;
   const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);

    const user = await User.findOne({
      MobNo: cleanPhone
    });

    if (!user) {

        throw new ExpressError(
            404,
            "User not found"
        );

    }

    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!isMatch) {

        throw new ExpressError(
            400,
            "Invalid password"
        );

    }

    const token = jwt.sign(
         {
            id: user._id
         },
         JWT_SECRET,
         {
            expiresIn: "7d"
         }
      );

      res.cookie("token", token, {
         httpOnly: true,
         maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(200).json({
         success: true,
         message: "Login successful",
         user: {
            id: user._id,
            name: user.name,
            MobNo: user.MobNo
         }
      });

};

const getCurrentUser = async (req, res) => {
    const user = await User.findById(req.userId).select("name MobNo");

    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json({
        success: true,
        user
    });
};

const logout = (req, res) => {
    res.clearCookie("token");

    res.json({
        success: true,
        message: "Logout successful"
    });
};

module.exports = {
   
   login,
   registerUser,
   sendOtp,
   verifyOtp,
   getCurrentUser,
   logout
};