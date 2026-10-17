import React, { useState } from "react";

import BuyActionWindow from "./BuyActionWindow";

const GeneralContext = React.createContext({
  openBuyWindow: (stock, mode) => {},
  closeBuyWindow: () => {},
});

export const GeneralContextProvider = (props) => {
  const [isBuyWindowOpen, setIsBuyWindowOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedMode, setSelectedMode] = useState("");
  const [refreshOrders, setRefreshOrders] = useState(false);

  const triggerOrdersRefresh = () => {
    setRefreshOrders((prev) => !prev);
  };

  const handleOpenBuyWindow = (stock, mode) => {
    setIsBuyWindowOpen(true);
    setSelectedStock(stock);
    setSelectedMode(mode);
  };

  const handleCloseBuyWindow = () => {
    setIsBuyWindowOpen(false);
    setSelectedStock(null);
    setSelectedMode("");
  };

  return (
    <GeneralContext.Provider
      value={{
        openBuyWindow: handleOpenBuyWindow,
        closeBuyWindow: handleCloseBuyWindow,
        triggerOrdersRefresh,
        refreshOrders,
      }}
    >
      {props.children}

      {isBuyWindowOpen && selectedStock && (
        <BuyActionWindow
          stock={selectedStock}
          mode={selectedMode}
        />
      )}
    </GeneralContext.Provider>
  );
};

export default GeneralContext;