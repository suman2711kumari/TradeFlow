import React, { useState, useRef} from "react";
import axios from "axios";
import "../../index.css";
import { useNavigate } from "react-router-dom";

function VerifyOtp(){

   const navigate = useNavigate();
   const [otp, setOtp] = useState("");
   const inputRef = useRef(null);
   const phone = localStorage.getItem("phone");

   const verify = async()=>{

      try{

         const res = await axios.post(
            "http://localhost:3002/verify-otp",
            {
               phone,
               otp
            }
         );

         console.log(res.data);
         navigate("/CompleteProfile")

      }
      catch(err){
         console.log(err);
      }
   };

   return(
      <div className="container text-center mt-5 p-3 mb-5">
         <div className = "row">
         <div className="col-md-6">
            <img src="https://signup.zerodha.com/assets/page-otp-DLrksP7J.svg"/>
         </div>
         <div className="col-md-6 ">
            <div>

               <h2>Enter OTP</h2>

               <div className="otp-wrapper">
                  
                  <input
                     ref={inputRef}
                     className="real-input"
                     type="text"
                     maxLength="6"
                     value={otp}
                     onChange={(e)=>setOtp(e.target.value)}
                  />

                  <div
                     className="otp-box-container"
                     onClick={() => inputRef.current.focus()}
                  >
                     {[...Array(6)].map((_, index) => (
                        <div
                           key={index}
                           className={`otp-box ${
                              otp.length === index ? "active" : ""
                           }`}
                        >
                           {otp[index]||"•"}
                        </div>
                     ))}
                  </div>
               </div>
               <br></br>
               <button className="mt-3 btn btn-primary" onClick={verify}>
                  Verify OTP
               </button>

            </div>
         </div>
      </div>
      </div>
   );
}

export default VerifyOtp;