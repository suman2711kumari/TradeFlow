import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { useNavigate } from "react-router-dom";
import { useState } from "react";

import axios from "axios";

function Phone({ className }) {

  const navigate = useNavigate();
  
  const [phone, setPhone] = useState("");

  const sendOtp = async (e) => {

    e.preventDefault();

    try {

      const res = await axios.post(
        "http://localhost:3002/send-otp",
        { phone }
      );

      console.log(res.data);

      localStorage.setItem("phone", phone);

      navigate("/verify-otp");

    }
    catch(err){
      console.log(err);
    }
  };

  return (

    <form onSubmit={sendOtp}>

      <PhoneInput
        country={"in"}
        enableSearch={true}
        containerClass={className}

        value={phone}

        onChange={(phone) => setPhone(phone)}

        inputStyle={{
          width: "100%",
          height: "50px",
          fontSize: "18px",
        }}

        buttonStyle={{
          height: "50px",
        }}
      />

      <button
        type="submit"
        className="mt-3 btn btn-primary"
      >
        Get OTP
      </button>

    </form>
  );
}

export default Phone;