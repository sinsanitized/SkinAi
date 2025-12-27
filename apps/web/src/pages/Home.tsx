import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageUpload } from "../components/ImageUpload/ImageUpload";
import RoastLoader from "../components/RoastLoader/RoastLoader";
import { apiService } from "../services/api";
import type { SkinAnalysisRequest } from "@skinai/shared-types";
import "./Home.css";

const Home: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [prefs, setPrefs] = useState<SkinAnalysisRequest>({
    goals: "",
    budget: "Mid",
    fragranceFree: false,
    pregnancySafe: false,
    sensitiveMode: false,
  });

  const navigate = useNavigate();

  const handleAnalyze = async () => {
    if (!file) return alert("Please upload a face photo first!");

    setLoading(true);

    try {
      const analysis = await apiService.analyzeSkin(file, prefs);
      setLoading(false);

      navigate("/result", {
        state: {
          file,
          analysis,
          prefs,
        },
      });
    } catch (err: any) {
      setLoading(false);
      console.error(err);
      alert(err?.message || "Failed to analyze skin");
    }
  };

  return (
    <div className="home-container">
      <h1 className="title">SkinAI 🧴</h1>

      {loading ? (
        <RoastLoader />
      ) : (
        <>
          <ImageUpload onImagesSelected={(files) => setFile(files[0])} />

          <div className="context-box">
            <label className="context-label">Goals (optional)</label>
            <input
              type="text"
              className="context-input"
              placeholder='e.g. "acne + dark spots", "redness", "oil control"'
              value={prefs.goals || ""}
              onChange={(e) => setPrefs((p) => ({ ...p, goals: e.target.value }))}
            />
          </div>

          <div className="prefs-grid">
            <div className="pref">
              <label>Budget</label>
              <select
                value={prefs.budget || "Mid"}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, budget: e.target.value as any }))
                }
              >
                <option value="Drugstore">Drugstore</option>
                <option value="Mid">Mid</option>
                <option value="Premium">Premium</option>
              </select>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!prefs.fragranceFree}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, fragranceFree: e.target.checked }))
                }
              />
              Fragrance-free
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!prefs.pregnancySafe}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, pregnancySafe: e.target.checked }))
                }
              />
              Pregnancy-safe
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!prefs.sensitiveMode}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, sensitiveMode: e.target.checked }))
                }
              />
              Sensitive mode (extra gentle)
            </label>
          </div>

          <button className="continue-btn" onClick={handleAnalyze}>
            Analyze Skin
          </button>
        </>
      )}
    </div>
  );
};

export default Home;
