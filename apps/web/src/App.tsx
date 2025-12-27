import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SkinResult from "./pages/SkinResult";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/result" element={<SkinResult />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
