
import React, { useState, useEffect } from "react";
import axios from "axios";

const apiUrl = `http://${window.location.hostname}:3002`;

const Funds = () => {


  const [funds, setFunds] = useState(null);
  const [holdings, setHoldings] = useState([]);

  useEffect(() => {

    const fetchData = async () => {

      try {

        const [fundsRes, holdingsRes] = await Promise.all([
          axios.get(`${apiUrl}/api/funds`, {
            withCredentials: true
          }),

          axios.get(`${apiUrl}/api/allHoldings`, {
            withCredentials: true
          })
        ]);

        setFunds(fundsRes.data);
        setHoldings(holdingsRes.data);

      } catch (err) {

        console.log("Failed to fetch funds data:", err);

      }

    };

    fetchData();

  }, []);


  if (!funds) {
    return <p>Loading funds...</p>;
  }


  // Total amount invested in currently held stocks
  const totalInvestment = holdings.reduce(
    (total, stock) =>
      total + Number(stock.avg) * Number(stock.qty),
    0
  );


  // Current market value of holdings
  const currentValue = holdings.reduce(
    (total, stock) =>
      total + Number(stock.price) * Number(stock.qty),
    0
  );


  // Profit / Loss
  const pnl = currentValue - totalInvestment;


  // P&L percentage
  const pnlPercentage =
    totalInvestment > 0
      ? (pnl / totalInvestment) * 100
      : 0;


  return (
    <>
      <div className="funds">

        <p>
          Virtual trading funds for your portfolio
        </p>

        <button className="btn btn-green">
          Add funds
        </button>

        <button className="btn btn-blue">
          Withdraw
        </button>

      </div>


      <div className="row">


        {/* Available cash */}

        <div className="col">

          <h5>
            Available cash
          </h5>

          <p className="imp colored">
            ₹{funds.availableCash.toFixed(2)}
          </p>

        </div>


        {/* Used margin */}

        <div className="col">

          <h5>
            Used margin
          </h5>

          <p className="imp">
            ₹{totalInvestment.toFixed(2)}
          </p>

        </div>


        {/* Opening balance */}

        <div className="col">

          <h5>
            Opening balance
          </h5>

          <p className="imp">
            ₹{funds.openingBalance.toFixed(2)}
          </p>

        </div>

      </div>


      <div className="row">


        {/* Total investment */}

        <div className="col">

          <h5>
            ₹{totalInvestment.toFixed(2)}
          </h5>

          <p>
            Total investment
          </p>

        </div>


        {/* Current value */}

        <div className="col">

          <h5>
            ₹{currentValue.toFixed(2)}
          </h5>

          <p>
            Current value
          </p>

        </div>


        {/* P&L */}

        <div className="col">

          <h5 className={pnl >= 0 ? "profit" : "loss"}>

            ₹{pnl.toFixed(2)}

            {" "}

            ({pnlPercentage.toFixed(2)}%)

          </h5>

          <p>
            P&L
          </p>

        </div>

      </div>

    </>
  );
};

export default Funds;