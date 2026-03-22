import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageUpload } from "../components/ImageUpload/ImageUpload";
import RoastLoader from "../components/RoastLoader/RoastLoader";
import { apiService } from "../services/api";
import type { SkinAnalysisRequest, ValueFocus } from "@skinai/shared-types";
import "./Home.css";

const RESULT_STORAGE_KEY = "skinai:last-result";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read selected image"));
    reader.readAsDataURL(file);
  });
}

function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [prefs, setPrefs] = useState<SkinAnalysisRequest>({
    goals: "",
    age: 38,
    valueFocus: "best_value",
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
      const imageDataUrl = await fileToDataUrl(file);

      sessionStorage.setItem(
        RESULT_STORAGE_KEY,
        JSON.stringify({
          analysis,
          prefs,
          imageDataUrl,
        })
      );

      setLoading(false);

      navigate("/result", {
        state: {
          analysis,
          prefs,
          imageDataUrl,
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
          <ImageUpload
            onImagesSelected={(files) => setFile(files[0] ?? null)}
            onRemove={() => setFile(null)}
          />

          <div className="context-box">
            <label className="context-label">Goals (optional)</label>
            <input
              type="text"
              className="context-input"
              placeholder='e.g. "acne + dark spots", "redness", "oil control"'
              value={prefs.goals || ""}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, goals: e.target.value }))
              }
            />
          </div>

          <div className="prefs-grid">
            <div className="pref">
              <label>Age</label>
              <input
                type="number"
                min={10}
                max={90}
                value={typeof prefs.age === "number" ? prefs.age : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPrefs((p) => ({
                    ...p,
                    age: Number.isFinite(n) ? n : undefined,
                  }));
                }}
              />
            </div>

            <div className="pref">
              <label>Value focus</label>
              <select
                value={prefs.valueFocus || "best_value"}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    valueFocus: e.target.value as ValueFocus,
                  }))
                }
              >
                <option value="best_value">Best value (worth it)</option>
                <option value="midrange_worth_it">Midrange worth it</option>
                <option value="splurge_if_unique">
                  Splurge only if unique
                </option>
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
}

export default Home;
