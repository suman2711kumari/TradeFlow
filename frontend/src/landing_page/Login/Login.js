import React,{ useState } from "react";
import axios from "axios";
import "./Login.css";

function Login() {
  const apiUrl = `http://${window.location.hostname}:3002`;

    const [phone, setPhone] = useState("");

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    
    const handleLogin = async () => {

        try {

            const res = await axios.post(
                `${apiUrl}/login`,
                {
                  phone: phone.trim(),
                    password
                },
                {
                    withCredentials: true
                }
            );
            console.log(res.data);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            
            //alert("login successfull")
            console.log("Redirecting to dashboard...");
            console.log(window.location.origin);
            window.location.href = `${window.location.protocol}//${window.location.hostname}:3000/summary`;

        }
        catch(err){

            alert(
                err.response?.data?.message ||
                "Login failed"
            );

        }

    };




  return (
    <div className="login-page">

      <div className="login-card">

        {/* Logo */}
        <div className="text-center mb-4">
          <img
            src="https://kite.zerodha.com/static/images/kite-logo.svg"
            alt="kite"
            className="kite-logo"
          />
        </div>

        {/* Heading */}
        <h2 className="login-title">Login to Kite</h2>

        {/* Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Phone number"
            className="form-control custom-input"
            onChange={(e)=>
                    setPhone(e.target.value)
                }
          />
        </div>

        {/* Password */}
        {/* Password */}
<div className="password-box mb-4">

  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    className="form-control custom-input"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />

  <span
    className="eye-icon"
    onClick={() => setShowPassword(!showPassword)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setShowPassword(!showPassword);
      }
    }}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? "🙈" : "👁️"}
  </span>

</div>

        {/* Button */}
        <button className="btn login-btn" onClick={handleLogin}>
          Login
        </button>

        {/* Forgot */}
        <a className="forgot-text">
          Forgot user ID or password?
        </a>

      </div>

      {/* Bottom Section */}
      <div className="bottom-section">

        <div className="store-icons">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
            alt="playstore"
            className="store-img"
          />

          <img
            src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
            alt="apple"
            className="apple-img"
          />
        </div>

        <p className="signup-text">
          Don't have an account? <span><a href="/signup">Sign up</a></span> for free!
        </p>

        <p className="footer-text">
          TradeFlow Broking Limited: Member of NSE, BSE, MCX
        </p>

      </div>

    </div>
  );
}

export default Login;