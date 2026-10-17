import React, { useState } from "react";

const Apps = () => {

  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [type, setType] = useState("BUY");


  const orderValue =
    Number(quantity) * Number(price);


  // Simulated brokerage
  const brokerage =
    Math.min(orderValue * 0.0003, 20);


  // Simulated transaction charge
  const transactionCharge =
    orderValue * 0.0000297;


  // GST on brokerage + transaction charge
  const gst =
    (brokerage + transactionCharge) * 0.18;


  const totalCharges =
    brokerage +
    transactionCharge +
    gst;


  const totalAmount =
    type === "BUY"
      ? orderValue + totalCharges
      : orderValue - totalCharges;


  return (

    <div style={{ padding: "30px" }}>

      <h2>Trading Apps</h2>

      <p>
        Useful tools for your trading simulator
      </p>


      <div
        style={{
          maxWidth: "500px",
          marginTop: "30px",
          padding: "25px",
          border: "1px solid #ddd",
          borderRadius: "10px"
        }}
      >

        <h3>
          Brokerage Calculator
        </h3>

        <p>
          Estimate charges for a simulated trade.
        </p>


        {/* BUY / SELL */}

        <div style={{ marginTop: "20px" }}>

          <label>
            Order type
          </label>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px",
              marginTop: "5px"
            }}
          >

            <option value="BUY">
              Buy
            </option>

            <option value="SELL">
              Sell
            </option>

          </select>

        </div>


        {/* Quantity */}

        <div style={{ marginTop: "15px" }}>

          <label>
            Quantity
          </label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) =>
              setQuantity(Number(e.target.value))
            }
            style={{
              display: "block",
              width: "100%",
              padding: "8px",
              marginTop: "5px"
            }}
          />

        </div>


        {/* Price */}

        <div style={{ marginTop: "15px" }}>

          <label>
            Price
          </label>

          <input
            type="number"
            min="0"
            step="0.05"
            value={price}
            onChange={(e) =>
              setPrice(Number(e.target.value))
            }
            style={{
              display: "block",
              width: "100%",
              padding: "8px",
              marginTop: "5px"
            }}
          />

        </div>


        {/* Results */}

        <div
          style={{
            marginTop: "25px",
            borderTop: "1px solid #ddd",
            paddingTop: "15px"
          }}
        >

          <p>
            Order value:
            <strong>
              {" "}₹{orderValue.toFixed(2)}
            </strong>
          </p>


          <p>
            Brokerage:
            <strong>
              {" "}₹{brokerage.toFixed(2)}
            </strong>
          </p>


          <p>
            Transaction charges:
            <strong>
              {" "}₹{transactionCharge.toFixed(2)}
            </strong>
          </p>


          <p>
            GST:
            <strong>
              {" "}₹{gst.toFixed(2)}
            </strong>
          </p>


          <hr />


          <p>

            Total charges:
            <strong>
              {" "}₹{totalCharges.toFixed(2)}
            </strong>

          </p>


          <p>

            {type === "BUY"
              ? "Total amount required:"
              : "Amount received:"
            }

            <strong>
              {" "}₹{totalAmount.toFixed(2)}
            </strong>

          </p>

        </div>

      </div>

    </div>

  );
};

export default Apps;
