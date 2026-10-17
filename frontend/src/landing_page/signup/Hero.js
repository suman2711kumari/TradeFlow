import React,{ useState, useEffect } from "react";
import axios from "axios";
import Phone from "./MobNo";
import "../../index.css";

function Hero(){
    const [phone, setPhone] = useState("");  
    return(
        
        <div className="container border-bottom mb-5">
            <div className="text-center mt-5 p-3">
                <h3>Open a free demat and trading Acount Online</h3> 
                <h5 className="text-muted mt-3 fs-4">Start investing brokerage free and join a community of 1.6+ crore investors and traders</h5>
                <div>
                    <div className="row">
                        <div className="col-md-6">
                            <img src="https://zerodha.com/static/images/account_open.svg" alt="signup"/>
                        </div>
                        <div className="col-md-6 custom-margin d-flex flex-column align-items-center">
                            <h3>Signup now</h3>
                            <p className="text-muted mt-1 fs-8">Or track your existing application</p>
                            <div className="phone-wrapper">
                                <Phone className="phone"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
           
        </div>
    );

}
export default Hero;