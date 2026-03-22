import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SkinResult from "./pages/SkinResult";
import "./App.css";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "skinai:theme";

function getInitialTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="appShell">
        <div className="appToolbar">
          <button
            type="button"
            className="themeToggle"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "light" ? "dark" : "light"
              )
            }
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
          >
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/result" element={<SkinResult />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
