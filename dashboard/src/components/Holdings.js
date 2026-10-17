import React, { useState, useEffect } from "react";
import axios from "axios";
import { VerticalGraph } from "./VerticalGraph";

const apiUrl = `http://${window.location.hostname}:3002`;

// import { holdings } from "../data/data";

const Holdings = () => {
  const [allHoldings, setAllHoldings] = useState([]);
  const [loadError, setLoadError] = useState("");
  const totalInvestment = allHoldings.reduce((t, h) => t + h.avg * h.qty, 0);
  const currentValue = allHoldings.reduce((t, h) => t + h.price * h.qty, 0);
  const totalPnl = currentValue - totalInvestment;
  const pnlPct = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0;
  const money = (v) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const anyStale = allHoldings.some((h) => h.priceSource !== "live");

  useEffect(() => {
    axios.get(`${apiUrl}/api/allHoldings`, {
      withCredentials: true
    }).then((res) => {
      setAllHoldings(res.data);
    }).catch(() => setLoadError("Could not load holdings."));
  }, []);

  // const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
  const labels = allHoldings.map((subArray) => subArray["name"]); //subArray → represents each individual element during iteration

  const data = {
    labels,
    datasets: [
      {
        label: "Stock Price",
        data: allHoldings.map((stock) => stock.price),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };

  return (
    <>
      <h3 className="title">Holdings ({allHoldings.length})</h3>

      <div className="order-table">
        <table>
          <thead>
              <tr>
              <th>Instrument</th>
              <th>Qty.</th>
              <th>Avg. cost</th>
              <th>LTP</th>
              <th>Cur. val</th>
              <th>P&L</th>
              <th>Net chg.</th>
              <th>Day chg.</th>
            </tr>
          </thead>

          <tbody>
            {allHoldings.map((stock, index) => {
            const curValue = stock.price * stock.qty;
            const isProfit = curValue - stock.avg * stock.qty >= 0.0;
            const profClass = isProfit ? "profit" : "loss";
            const dayClass = stock.isLoss ? "loss" : "profit";

            return (
              <tr key={index}>
                <td>{stock.name}</td>
                <td>{stock.qty}</td>
                <td>{stock.avg.toFixed(2)}</td>
                <td>{stock.price.toFixed(2)}</td>
                <td>{curValue.toFixed(2)}</td>
                <td className={profClass}>
                  {(curValue - stock.avg * stock.qty).toFixed(2)}
                </td>
                <td className={profClass}>{stock.net}</td>
                <td className={dayClass}>{stock.day}</td>
              </tr>
              
            );
            
          }
           )}
            </tbody>
        </table>
      </div>

      {loadError && <p className="order-error" role="alert">{loadError}</p>}
      {anyStale && <p className="order-note">Some prices could not be refreshed and show the last available value.</p>}
      <div className="row">
        <div className="col"><h5>{money(totalInvestment)}</h5><p>Total investment</p></div>
        <div className="col"><h5>{money(currentValue)}</h5><p>Current value</p></div>
        <div className="col"><h5 className={totalPnl >= 0 ? "profit" : "loss"}>{money(totalPnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</h5><p>P&L</p></div>
      </div>
      <VerticalGraph data={data} />
    </>
  );
};

export default Holdings;
