import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageUpload } from "../components/ImageUpload/ImageUpload";
import SkinAnalysisLoader from "../components/SkinAnalysisLoader/SkinAnalysisLoader";
import { skinAnalysisApi } from "../services/skinAnalysisApi";
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

  const [analysisOptions, setAnalysisOptions] = useState<SkinAnalysisRequest>({
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
      const analysis = await skinAnalysisApi.analyzeSkin(file, analysisOptions);
      const imageDataUrl = await fileToDataUrl(file);

      sessionStorage.setItem(
        RESULT_STORAGE_KEY,
        JSON.stringify({
          analysis,
          analysisOptions,
          imageDataUrl,
        })
      );

      setLoading(false);

      navigate("/result", {
        state: {
          analysis,
          analysisOptions,
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
        <SkinAnalysisLoader />
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
              value={analysisOptions.goals || ""}
              onChange={(e) =>
                setAnalysisOptions((currentOptions) => ({
                  ...currentOptions,
                  goals: e.target.value,
                }))
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
                value={
                  typeof analysisOptions.age === "number"
                    ? analysisOptions.age
                    : ""
                }
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setAnalysisOptions((currentOptions) => ({
                    ...currentOptions,
                    age: Number.isFinite(n) ? n : undefined,
                  }));
                }}
              />
            </div>

            <div className="pref">
              <label>Value focus</label>
              <select
                value={analysisOptions.valueFocus || "best_value"}
                onChange={(e) =>
                  setAnalysisOptions((currentOptions) => ({
                    ...currentOptions,
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
                checked={!!analysisOptions.fragranceFree}
                onChange={(e) =>
                  setAnalysisOptions((currentOptions) => ({
                    ...currentOptions,
                    fragranceFree: e.target.checked,
                  }))
                }
              />
              Fragrance-free
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!analysisOptions.pregnancySafe}
                onChange={(e) =>
                  setAnalysisOptions((currentOptions) => ({
                    ...currentOptions,
                    pregnancySafe: e.target.checked,
                  }))
                }
              />
              Pregnancy-safe
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!analysisOptions.sensitiveMode}
                onChange={(e) =>
                  setAnalysisOptions((currentOptions) => ({
                    ...currentOptions,
                    sensitiveMode: e.target.checked,
                  }))
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
