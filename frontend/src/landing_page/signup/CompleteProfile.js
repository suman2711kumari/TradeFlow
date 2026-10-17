import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import "../../index.css";

function CompleteProfile(){
   const navigate = useNavigate();
   const [name,setName] = useState("");
   const [password,setPassword] = useState("");

   const submit = async()=>{

      const phone = localStorage.getItem("phone");

      await axios.post(
         "http://localhost:3002/register",
         {
            name,
            phone,
            password
         }
      );

      navigate("/product");
   };

   return(
      <div className="row container text-center mt-5 p-3 mb-5">
         <div className="col-md-6 ProfileWrapper">
            <input
            className="input"
            placeholder="Name"
            onChange={(e)=>setName(e.target.value)}
            />
            <br></br>
            <input 
               className="input"
               type="password"
               placeholder="Password"
               onChange={(e)=>setPassword(e.target.value)}
            />
            <br></br>
            <button className="mt-3 btn btn-primary" onClick={submit}>Continue</button>
         </div>
         <div className="col-md-6">
            <img src="https://signup.zerodha.com/assets/page-pan-DNhY7330.svg"/>
         </div>
         

      </div>
   );
}

export default CompleteProfile;