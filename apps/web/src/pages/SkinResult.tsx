import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SkinAnalysisResponse, SkinAnalysisRequest } from "@skinai/shared-types";
import "./SkinResult.css";

interface LocationState {
  file: File;
  analysis: SkinAnalysisResponse;
  prefs: SkinAnalysisRequest;
}

const SkinResult: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;

  if (!state) {
    navigate("/");
    return null;
  }

  const { file, analysis } = state;
  const imageUrl = URL.createObjectURL(file);

  return (
    <div className="result-container">
      <h1 className="title">SkinAI Results</h1>

      <div className="topRow">
        <div className="photoCard">
          <img src={imageUrl} alt="uploaded face" className="photo" />
        </div>

        <div className="summaryCard">
          <h2>Skin Type</h2>
          <div className="pill">
            {analysis.skinType.type} • {Math.round(analysis.skinType.confidence * 100)}%
          </div>

          <h2>Top Concerns</h2>
          <div className="concerns">
            {analysis.concerns?.slice(0, 6).map((c, idx) => (
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
              {analysis.routine?.AM?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="routineBlock">
            <h3>PM</h3>
            <ol>
              {analysis.routine?.PM?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          {analysis.routine?.weekly?.length ? (
            <div className="routineBlock">
              <h3>Weekly</h3>
              <ul>
                {analysis.routine.weekly.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Ingredients</h2>
          <ul className="list">
            {analysis.ingredients?.map((ing, i) => (
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
            {analysis.products?.slice(0, 10).map((p, i) => (
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
              {analysis.conflicts.map((c, i) => (
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
            {analysis.disclaimers?.map((d, i) => (
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
};

export default SkinResult;
