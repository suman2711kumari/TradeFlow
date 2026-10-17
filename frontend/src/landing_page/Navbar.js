import React from "react";
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="tf-navbar navbar navbar-expand-lg">
      <div className="container tf-nav-inner">
        <Link className="tf-brand navbar-brand" to="/" aria-label="TradeFlow home">
          <span className="tf-mark">T<span>F</span></span><span className="tf-brand-copy">TradeFlow<small>MARKET WORKSPACE</small></span>
        </Link>
        <button className="navbar-toggler tf-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation"><span className="navbar-toggler-icon" /></button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav ms-auto align-items-lg-center tf-nav-links">
            <li className="nav-item"><Link className="nav-link" to="/product">Platform</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/about">About</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/pricing">Pricing</Link></li>
            <li className="nav-item"><Link className="nav-link" to="/support">Support</Link></li>
            <li className="nav-item tf-nav-login"><Link className="nav-link" to="/login">Sign in <span>↗</span></Link></li>
            <li className="nav-item"><Link className="tf-nav-cta" to="/signup">Get started</Link></li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
