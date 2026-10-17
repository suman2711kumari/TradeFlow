import React from "react";
import Hero from "./Hero";
import Options from "./InvestOptions";
import Steps from "./Steps";
import Benefits from "./Benefits";

function Signup(){
    console.log("Signup loaded");
    return(
        <div>
        <Hero />
        <Options />
        <Steps />
        <Benefits />
        
        </div>
    );
}

export default Signup;