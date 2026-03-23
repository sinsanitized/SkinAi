import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ImageUpload } from "../components/ImageUpload/ImageUpload";
import SkinAnalysisLoader from "../components/SkinAnalysisLoader/SkinAnalysisLoader";
import { skinAnalysisApi } from "../services/skinAnalysisApi";
import type {
  RoutineIntensity,
  SkinAnalysisRequest,
} from "@skinai/shared-types";
import "./Home.css";

const RESULT_STORAGE_KEY = "skinai:last-result";
const ROUTINE_INTENSITY_STEPS: RoutineIntensity[] = [
  "minimal",
  "balanced",
  "more_active",
];
const ROUTINE_INTENSITY_LABELS: Record<RoutineIntensity, string> = {
  minimal: "Minimal",
  balanced: "Balanced",
  more_active: "Intense",
};
const DEFAULT_ANALYSIS_OPTIONS: SkinAnalysisRequest = {
  goals: "",
  routineIntensity: "balanced",
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

function resolveRoutineIntensity(
  routineIntensity?: RoutineIntensity,
): RoutineIntensity {
  return ROUTINE_INTENSITY_STEPS.includes(routineIntensity as RoutineIntensity)
    ? (routineIntensity as RoutineIntensity)
    : "balanced";
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
  const activeRoutineIntensity = resolveRoutineIntensity(
    analysisOptions.routineIntensity,
  );
  const routineIntensityStep = ROUTINE_INTENSITY_STEPS.indexOf(
    activeRoutineIntensity,
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
      <section className="intakeCard">
        <header className="heroPanel">
          <p className="eyebrow">Structured skincare guidance</p>
          <h1 className="title">SkinAI 🧴</h1>
          <p className="heroCopy">
            {loading
              ? "Reviewing your photo, matching it to the visible skin signals, and preparing a routine you can actually follow."
              : "Upload a clear face photo and describe what you want to improve to get a cleaner, more usable skincare plan."}
          </p>
        </header>

        {loading ? (
          <SkinAnalysisLoader />
        ) : (
          <>
          {errorMessage ? (
            <div className="errorBanner" role="alert" aria-live="assertive">
              {errorMessage}
            </div>
          ) : null}

            <section className="intakeSection">
              <h2 className="sectionTitle">Upload Photo</h2>
              <ImageUpload
                onImagesSelected={(files) => setFile(files[0] ?? null)}
                onRemove={() => setFile(null)}
              />
            </section>

            <section className="intakeSection">
              <h2 className="sectionTitle">Your Concerns</h2>
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
            </section>

            <section className="intakeSection">
              <h2 className="sectionTitle">Preferences</h2>
              <fieldset className="prefs-grid">
                <legend className="prefLegend">Preferences</legend>
                <div className="intensitySliderCard">
                  <div className="intensitySliderHeader">
                    <span className="preferenceLabel">Routine intensity</span>
                    <strong className="intensityValue">
                      {ROUTINE_INTENSITY_LABELS[activeRoutineIntensity]}
                    </strong>
                  </div>
                  <input
                    className="intensitySlider"
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    value={routineIntensityStep < 0 ? 1 : routineIntensityStep}
                    aria-label="Routine intensity"
                    onChange={(e) =>
                      setAnalysisOptions((currentOptions) => ({
                        ...currentOptions,
                        routineIntensity:
                          ROUTINE_INTENSITY_STEPS[Number(e.target.value)] ||
                          "balanced",
                      }))
                    }
                  />
                  <div className="intensityScale" aria-hidden="true">
                    <span
                      className={
                        activeRoutineIntensity === "minimal" ? "isActive" : ""
                      }
                    >
                      Minimal
                    </span>
                    <span
                      className={
                        activeRoutineIntensity === "balanced" ? "isActive" : ""
                      }
                    >
                      Balanced
                    </span>
                    <span
                      className={
                        activeRoutineIntensity === "more_active"
                          ? "isActive"
                          : ""
                      }
                    >
                      Intense
                    </span>
                  </div>
                  <p className="helperText intensityHelper">
                    Slide left for a simpler routine or right for a more active
                    plan.
                  </p>
                </div>

                <label className="preferenceChip">
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
                  <span>Fragrance-free</span>
                </label>

                <label className="preferenceChip">
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
                  <span>Pregnancy-safe</span>
                </label>

                <label className="preferenceChip">
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
                  <span>Sensitive mode</span>
                </label>
              </fieldset>
            </section>

            <div className="intakeFooter">
              <p className="helperText">
                SkinAI returns a structured routine, ingredient focus, and
                explanation based on the uploaded image and your preferences.
              </p>
              <button
                type="button"
                className="continue-btn"
                onClick={handleAnalyze}
                aria-label="Analyze uploaded skin photo"
              >
                Analyze Skin
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default Home;
