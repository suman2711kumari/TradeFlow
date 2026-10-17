
import React, { useState, useEffect } from "react";
import axios from "axios";

const apiUrl = `http://${window.location.hostname}:3002`;

const Summary = () => {
   

  const [allHoldings, setAllHoldings] = useState([]);
  const [funds, setFunds] = useState(null);

  const [user, setUser] = useState(null);

  useEffect(() => {
      const fetchUser = async () => {
          try {
              const res = await axios.get(
                  `${apiUrl}/me`,
                  {
                      withCredentials: true
                  }
              );

              setUser(res.data.user);
          } catch (err) {
              console.log("Failed to fetch user:", err);
          }
      };

      fetchUser();
  }, []);

  // Fetch holdings
  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/allHoldings`, {
          withCredentials: true
        });

        setAllHoldings(res.data);
      } catch (err) {
        console.log("Failed to fetch holdings:", err);
      }
    };

    fetchHoldings();
  }, []);

  // Fetch funds
  useEffect(() => {
    

    axios.get(`${apiUrl}/api/funds`, {
        withCredentials: true
    })
    .then((res) => {
        console.log("🔥 FUNDS DATA:", res.data);
        setFunds(res.data);
    })
    .catch((err) => {
        console.log("❌ FUNDS ERROR:", err);
        console.log("❌ RESPONSE:", err.response?.data);
    });
}, []);

  // Total investment
  const investment = allHoldings.reduce(
    (total, stock) => total + stock.avg * stock.qty,
    0
  );

  // Current value
  const currentValue = allHoldings.reduce(
    (total, stock) => total + stock.price * stock.qty,
    0
  );

  // Profit / Loss
  const pnl = currentValue - investment;

  // Profit / Loss percentage
  const pnlPercentage =
    investment > 0 ? (pnl / investment) * 100 : 0;

  const isProfit = pnl >= 0;


  return (
    <>
      <div className="username">
        <h6>Hi, {user ? user.name : "User"}!</h6>
        <hr className="divider" />
      </div>


      {/* ================= EQUITY ================= */}

      <div className="section">
        <span>
          <p>Equity</p>
        </span>

        <div className="data">

          <div className="first">
            <h3>
              {funds ? funds.availableCash.toFixed(2) : "Loading..."}
            </h3>

            <p>Margin available</p>
          </div>

          <hr />

          <div className="second">

            <p>
              Margins used{" "}
              <span>
                {funds ? funds.usedMargin.toFixed(2) : "Loading..."}
              </span>
            </p>

            <p>
              Opening balance{" "}
              <span>
                {funds ? funds.openingBalance.toFixed(2) : "Loading..."}
              </span>
            </p>

          </div>
        </div>

        <hr className="divider" />
      </div>


      {/* ================= HOLDINGS ================= */}

      <div className="section">

        <span>
          <p>Holdings ({allHoldings.length})</p>
        </span>

        <div className="data">

          <div className="first">

            <h3 className={isProfit ? "profit" : "loss"}>

              {Math.abs(pnl).toFixed(2)}

              <small>
                {" "}
                {isProfit ? "+" : "-"}
                {Math.abs(pnlPercentage).toFixed(2)}%
              </small>

            </h3>

            <p>P&L</p>

          </div>

          <hr />

          <div className="second">

            <p>
              Current Value{" "}
              <span>
                {currentValue.toFixed(2)}
              </span>
            </p>

            <p>
              Investment{" "}
              <span>
                {investment.toFixed(2)}
              </span>
            </p>

          </div>

        </div>

        <hr className="divider" />

      </div>
    </>
  );
};

export default Summary;


// ### Now your Summary is fully connected

// Your dashboard will work like this:

// ```text
//                  MongoDB
//                     │
//           ┌─────────┴─────────┐
//           ↓                   ↓
//        Funds                Holdings
//           │                   │
//           ↓                   ↓
//     availableCash       investment
//     openingBalance      currentValue
//     usedMargin              P&L
//           │                   │
//           └─────────┬─────────┘
//                     ↓
//                 Summary.js
// ```

// So, for example, after you BUY ₹500:

// **Before:**

// ```text
// Margin available    ₹10,000
// Opening balance     ₹10,000
// ```

// **After:**

// ```text
// Margin available    ₹9,500
// Opening balance     ₹10,000
// ```

// And the Holdings section will independently calculate the investment/current value/P&L from your holdings.

// ### One small thing

// Your:

// ```jsx
// <h6>Hi, User!</h6>
// ```

// is still hardcoded.

// Since you already have `/me` working and `Menu.js` successfully displays the logged-in user's name, we can make this:

// ```text
// Hi, Suman!
// ```

// dynamic too. But **that can be done later**. It isn't necessary for the Funds/Positions functionality.

// For now, test the Summary after a BUY and SELL. If the Equity values change there, **Summary + Funds are done** ✅. Then we can move directly to `Positions.js`. 🚀
