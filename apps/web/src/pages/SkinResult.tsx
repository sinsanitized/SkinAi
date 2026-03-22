import { useLocation, useNavigate } from "react-router-dom";
import type {
  IngredientConflict,
  IngredientRecommendation,
  ProductRecommendation,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
  SkinConcern,
} from "@skinai/shared-types";
import "./SkinResult.css";

const RESULT_STORAGE_KEY = "skinai:last-result";

interface LocationState {
  analysis: SkinAnalysisResponse;
  prefs: SkinAnalysisRequest;
  imageDataUrl?: string;
}

function SkinResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as LocationState | undefined;
  const storedState = (() => {
    const raw = sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as LocationState;
    } catch {
      return undefined;
    }
  })();
  const state = navigationState ?? storedState;

  if (!state) {
    navigate("/");
    return null;
  }

  const { analysis, imageDataUrl } = state;

  return (
    <div className="result-container">
      <h1 className="title">SkinAI Results</h1>

      <div className="topRow">
        <div className="photoCard">
          {imageDataUrl ? (
            <img src={imageDataUrl} alt="uploaded face" className="photo" />
          ) : (
            <div className="muted">Original photo preview unavailable.</div>
          )}
        </div>

        <div className="summaryCard">
          <h2>Skin Type</h2>
          <div className="pill">
            {analysis.skinType.type} • {Math.round(analysis.skinType.confidence * 100)}%
          </div>

          <h2>Top Concerns</h2>
          <div className="concerns">
            {analysis.concerns?.slice(0, 6).map((c: SkinConcern, idx: number) => (
              <div key={idx} className="concern">
                <div className="concernName">{c.name}</div>
                <div className="concernMeta">
                  {c.severity} • {Math.round(c.confidence * 100)}%
                </div>
                {c.evidence ? <div className="concernEvidence">{c.evidence}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Routine</h2>
          <div className="routineBlock">
            <h3>AM</h3>
            <ol>
              {analysis.routine?.AM?.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="routineBlock">
            <h3>PM</h3>
            <ol>
              {analysis.routine?.PM?.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          {analysis.routine?.weekly?.length ? (
            <div className="routineBlock">
              <h3>Weekly</h3>
              <ul>
                {analysis.routine.weekly.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Ingredients</h2>
          <ul className="list">
            {analysis.ingredients?.map((ing: IngredientRecommendation, i: number) => (
              <li key={i}>
                <div className="itemTitle">{ing.ingredient}</div>
                <div className="itemBody">{ing.reason}</div>
                {ing.cautions?.length ? (
                  <div className="itemCaution">Caution: {ing.cautions.join(" • ")}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Product Picks</h2>
          <ul className="list">
            {analysis.products?.slice(0, 10).map((p: ProductRecommendation, i: number) => (
              <li key={i}>
                <div className="itemTitle">
                  {p.brand ? `${p.brand} — ` : ""}{p.name}
                  <span className="tag">{p.category}</span>
                </div>
                <div className="itemBody">{p.why}</div>
                {p.howToUse ? <div className="itemHow">How: {p.howToUse}</div> : null}
                {p.cautions?.length ? (
                  <div className="itemCaution">Caution: {p.cautions.join(" • ")}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Conflicts & Warnings</h2>
          {analysis.conflicts?.length ? (
            <ul className="list">
              {analysis.conflicts.map((c: IngredientConflict, i: number) => (
                <li key={i}>
                  <div className="itemTitle">{c.ingredients.join(" + ")}</div>
                  <div className="itemBody">{c.warning}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None flagged.</p>
          )}

          <h2>Disclaimers</h2>
          <ul className="list">
            {analysis.disclaimers?.map((d: string, i: number) => (
              <li key={i} className="muted">{d}</li>
            ))}
          </ul>
        </div>
      </div>

      <button className="start-over-btn" onClick={() => navigate("/")}>
        Analyze Another Photo
      </button>
    </div>
  );
}

export default SkinResult;
