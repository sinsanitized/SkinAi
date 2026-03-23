import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ImageUpload } from "../components/ImageUpload/ImageUpload";
import SkinAnalysisLoader from "../components/SkinAnalysisLoader/SkinAnalysisLoader";
import { skinAnalysisApi } from "../services/skinAnalysisApi";
import type { SkinAnalysisRequest, ValueFocus } from "@skinai/shared-types";
import "./Home.css";

const RESULT_STORAGE_KEY = "skinai:last-result";
const DEFAULT_ANALYSIS_OPTIONS: SkinAnalysisRequest = {
  goals: "",
  age: 38,
  valueFocus: "best_value",
  fragranceFree: false,
  pregnancySafe: false,
  sensitiveMode: false,
};

interface HomeLocationState {
  draftOptions?: SkinAnalysisRequest;
}

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as HomeLocationState | null;
  const [analysisOptions, setAnalysisOptions] = useState<SkinAnalysisRequest>(
    locationState?.draftOptions ?? DEFAULT_ANALYSIS_OPTIONS,
  );

  const handleAnalyze = async () => {
    if (!file) return alert("Please upload a face photo first!");
    setErrorMessage(null);
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
        }),
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
      setErrorMessage(err?.message || "Failed to analyze skin");
    }
  };

  return (
    <main className="home-container">
      <section className="heroPanel">
        <p className="eyebrow">Structured skincare guidance</p>
        <h1 className="title">SkinAI 🧴</h1>
        <p className="heroCopy">
          {loading
            ? "Reviewing your photo, matching it to the visible skin signals, and preparing a routine you can actually follow."
            : "Upload a clear face photo, add any concerns that matter to you, and get Skincare Routine."}
        </p>
      </section>

      {loading ? (
        <SkinAnalysisLoader />
      ) : (
        <>
          {errorMessage ? (
            <div className="errorBanner" role="alert" aria-live="assertive">
              {errorMessage}
            </div>
          ) : null}

          <ImageUpload
            onImagesSelected={(files) => setFile(files[0] ?? null)}
            onRemove={() => setFile(null)}
          />

          <div className="context-box">
            <label className="context-label" htmlFor="skin-goals">
              Describe your skin concerns
            </label>
            <textarea
              id="skin-goals"
              className="context-input"
              placeholder="Describe your skin concerns (e.g., acne, redness, dryness)"
              value={analysisOptions.goals || ""}
              rows={4}
              onChange={(e) =>
                setAnalysisOptions((currentOptions) => ({
                  ...currentOptions,
                  goals: e.target.value,
                }))
              }
            />
            <p className="helperText">More detail improves accuracy.</p>
          </div>

          <div className="prefs-grid">
            <div className="pref">
              <label htmlFor="skin-age">Age</label>
              <input
                id="skin-age"
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
              <label htmlFor="value-focus">Value focus</label>
              <select
                id="value-focus"
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

          <button
            type="button"
            className="continue-btn"
            onClick={handleAnalyze}
            aria-label="Analyze uploaded skin photo"
          >
            Analyze Skin
          </button>
        </>
      )}
    </main>
  );
}

export default Home;
