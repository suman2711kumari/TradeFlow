import React, { useState, useEffect,useContext } from "react";
import axios from "axios"; // removed { all }
import { Link } from "react-router-dom";
import GeneralContext from "./GeneralContext";

const apiUrl = `http://${window.location.hostname}:3002`;

function Orders() {
  const [allOrders, setAllOrders] = useState([]);
  const { refreshOrders } = useContext(GeneralContext);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/allOrders`,
          {
            withCredentials: true
          }
        );
        setAllOrders(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [refreshOrders]); // dependency added

  return (
    <div className="orders">
      {allOrders.length === 0 ? (
        <div className="no-orders">
          <p>You haven't placed any orders today</p>

          <Link to="/" className="btn">
            Get started
          </Link>
        </div>
      ) : (
        <>
          <h3 className="title">Orders ({allOrders.length})</h3>

          <div className="order-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Instrument</th>
                  <th>Qty.</th>
                  <th>Exec. price</th>
                  <th>Value</th>
                  <th>Realised P&L</th>
                </tr>
              </thead>

              <tbody>
                {allOrders.map((stock) => (
                  <tr key={stock._id}>
                    <td>{stock.createdAt ? new Date(stock.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className={stock.mode === "BUY" ? "profit" : "loss"}>{stock.mode}</td>
                    <td>{stock.name}</td>
                    <td>{stock.qty}</td>
                    <td>{Number(stock.price).toFixed(2)}</td>
                    <td>{Number(stock.value ?? stock.qty * stock.price).toFixed(2)}</td>
                    <td className={stock.realizedPnl > 0 ? "profit" : stock.realizedPnl < 0 ? "loss" : ""}>{stock.realizedPnl == null ? "—" : Number(stock.realizedPnl).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Orders;