import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import GeneralContext from "./GeneralContext";

// Positions = today's trading activity. Shares you keep beyond today are shown under Holdings.
function Positions() {
  const [allPositions, setAllPositions] = useState([]);
  const [error, setError] = useState("");
  const { refreshOrders } = useContext(GeneralContext);

  useEffect(() => {
    axios.get(`http://${window.location.hostname}:3002/api/allPositions`, { withCredentials: true })
      .then((res) => { setAllPositions(res.data); setError(""); })
      .catch(() => setError("Could not load positions."));
  }, [refreshOrders]);

  return (
    <>
      <h3 className="title">Positions ({allPositions.length})</h3>
      <p className="order-note" style={{ marginBottom: 12 }}>Today's trading activity only. Delivery shares you hold overnight appear in Holdings.</p>
      {error && <p className="order-error" role="alert">{error}</p>}
      {allPositions.length === 0 && !error ? (
        <div className="no-orders"><p>No trades placed today.</p></div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr><th>Product</th><th>Instrument</th><th>Net qty.</th><th>Avg.</th><th>LTP</th><th>P&L (day)</th><th>Chg.</th></tr>
            </thead>
            <tbody>
              {allPositions.map((p) => (
                <tr key={p.name}>
                  <td>{p.product}</td>
                  <td>{p.name}<small style={{ display: "block", opacity: 0.6 }}>bought {p.boughtQty} · sold {p.soldQty}</small></td>
                  <td>{p.qty}</td>
                  <td>{p.qty === 0 ? "—" : p.avg.toFixed(2)}</td>
                  <td>{p.price.toFixed(2)}</td>
                  <td className={p.pnl >= 0 ? "profit" : "loss"}>{p.pnl.toFixed(2)}</td>
                  <td className={p.isLoss ? "loss" : "profit"}>{p.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default Positions;
