import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import type {
  IngredientConflict,
  IngredientRecommendation,
  ProductRecommendation,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
  SkinConcern,
  SkinEducation,
} from "@skinai/shared-types";
import "./SkinResult.css";

const RESULT_STORAGE_KEY = "skinai:last-result";

interface SkinResultNavigationState {
  analysis: SkinAnalysisResponse;
  analysisOptions: SkinAnalysisRequest;
  imageDataUrl?: string;
}

function getConfidenceMeta(confidence: number) {
  const percent = Math.round(confidence * 100);

  if (percent >= 80) {
    return {
      percent,
      label: "High confidence",
      toneClassName: "confidenceHigh",
    };
  }

  if (percent >= 50) {
    return {
      percent,
      label: "Medium confidence",
      toneClassName: "confidenceMedium",
    };
  }

  return {
    percent,
    label: "Low confidence",
    toneClassName: "confidenceLow",
  };
}

function isFallbackAnalysis(analysis: SkinAnalysisResponse) {
  return analysis.disclaimers?.some((disclaimer) =>
    disclaimer.toLowerCase().includes("fallback response")
  );
}

function SkinResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as
    | SkinResultNavigationState
    | undefined;
  const storedState = (() => {
    const raw = sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as SkinResultNavigationState;
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
  const explanation: SkinEducation | undefined = analysis.explanation;
  const confidence = getConfidenceMeta(analysis.skinType.confidence);
  const primaryConcern = analysis.concerns?.[0];
  const fallbackAnalysis = isFallbackAnalysis(analysis);
  const shouldReduceMotion = useReducedMotion();

  const stackVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const cardVariants = {
    hidden: shouldReduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 22, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.18 : 0.42,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  return (
    <motion.main
      className="result-container"
      initial="hidden"
      animate="visible"
      variants={stackVariants}
    >
      <h1 className="title">SkinAI Results</h1>

      {fallbackAnalysis ? (
        <motion.div
          className="warningBanner"
          role="alert"
          aria-live="polite"
          variants={cardVariants}
        >
          ⚠️ We couldn&apos;t confidently analyze your input. Try adding more
          detail.
        </motion.div>
      ) : null}

      <motion.div className="topRow" variants={stackVariants}>
        <motion.div className="photoCard" variants={cardVariants}>
          {imageDataUrl ? (
            <img
              src={imageDataUrl}
              alt="Uploaded face photo used for skin analysis"
              className="photo"
            />
          ) : (
            <div className="muted" role="status" aria-live="polite">
              Original photo preview unavailable.
            </div>
          )}
        </motion.div>

        <motion.div className="summaryCard" variants={cardVariants}>
          <h2>🧴 Skin Analysis</h2>
          <div className="summaryStack">
            <div className="summaryItem">
              <span className="summaryLabel">Condition</span>
              <strong>{primaryConcern?.name || analysis.skinType.type}</strong>
            </div>
            <div className="summaryItem">
              <span className="summaryLabel">Severity</span>
              <strong>{primaryConcern?.severity || "Moderate"}</strong>
            </div>
            <div className={`confidencePill ${confidence.toneClassName}`}>
              📊 {confidence.percent}% - {confidence.label}
            </div>
            <div className="pill">Skin type: {analysis.skinType.type}</div>
          </div>

          <h2>Top concerns</h2>
          <div className="concerns">
            {analysis.concerns?.slice(0, 6).map((c: SkinConcern, idx: number) => (
              <div key={idx} className="concern">
                <div className="concernName">{c.name}</div>
                <div className="concernMeta">
                  {c.severity} • {Math.round(c.confidence * 100)}%
                </div>
                {c.evidence ? (
                  <div className="concernEvidence">{c.evidence}</div>
                ) : null}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="grid" variants={stackVariants}>
        {explanation ? (
          <motion.section
            className="card cardWide"
            aria-labelledby="skin-explanation-heading"
            variants={cardVariants}
          >
            <h2 id="skin-explanation-heading">🧠 Why this recommendation</h2>
            <div className="explanationGrid">
              <motion.div className="explanationSection" variants={cardVariants}>
                <h3>What your skin type means</h3>
                <p className="itemBody">{explanation.skinTypeExplanation}</p>
              </motion.div>

              <motion.div className="explanationSection" variants={cardVariants}>
                <h3>How the products help</h3>
                <ul className="list">
                  {explanation.productBenefits.map((benefit: string, i: number) => (
                    <li key={i}>
                      <div className="itemBody">{benefit}</div>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div className="explanationSection" variants={cardVariants}>
                <h3>How to stack the routine</h3>
                <ol className="stackingList">
                  {explanation.layeringGuide.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </motion.div>
            </div>
          </motion.section>
        ) : null}

        <motion.div className="card" variants={cardVariants}>
          <h2>🌞 Morning Routine</h2>
          <div className="routineBlock">
            <ol>
              {analysis.routine?.AM?.map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </motion.div>

        <motion.div className="card" variants={cardVariants}>
          <h2>🌙 Night Routine</h2>
          <div className="routineBlock">
            <ol>
              {analysis.routine?.PM?.map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          {analysis.routine?.weekly?.length ? (
            <div className="routineBlock">
              <h3>Weekly cadence</h3>
              <ul>
                {analysis.routine.weekly.map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </motion.div>

        <motion.div className="card" variants={cardVariants}>
          <h2>🧪 Key Ingredients</h2>
          <ul className="list">
            {analysis.ingredients?.map((ingredient: IngredientRecommendation, i: number) => (
              <li key={i}>
                <div className="itemTitle">{ingredient.ingredient}</div>
                <div className="itemBody">{ingredient.reason}</div>
                {ingredient.cautions?.length ? (
                  <div className="itemCaution">
                    Caution: {ingredient.cautions.join(" • ")}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className="card cardWide" variants={cardVariants}>
          <h2>🛍️ Product Picks</h2>
          <ul className="list">
            {analysis.products?.slice(0, 10).map((product: ProductRecommendation, i: number) => (
              <li key={i}>
                <div className="itemTitle">
                  {product.brand ? `${product.brand} — ` : ""}
                  {product.name}
                  <span className="tag">{product.category}</span>
                </div>
                <div className="itemBody">{product.why}</div>
                {product.howToUse ? (
                  <div className="itemHow">How: {product.howToUse}</div>
                ) : null}
                {product.cautions?.length ? (
                  <div className="itemCaution">
                    Caution: {product.cautions.join(" • ")}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className="card" variants={cardVariants}>
          <h2>⚠️ Conflicts & Warnings</h2>
          {analysis.conflicts?.length ? (
            <ul className="list">
              {analysis.conflicts.map((conflict: IngredientConflict, i: number) => (
                <li key={i}>
                  <div className="itemTitle">
                    {conflict.ingredients.join(" + ")}
                  </div>
                  <div className="itemBody">{conflict.warning}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None flagged.</p>
          )}

          <h2>Disclaimers</h2>
          <ul className="list">
            {analysis.disclaimers?.map((disclaimer: string, i: number) => (
              <li key={i} className="muted">
                {disclaimer}
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.div>

      <motion.div className="resultActions" variants={cardVariants}>
        <button
          className="start-over-btn"
          onClick={() =>
            navigate("/", { state: { draftOptions: state.analysisOptions } })
          }
        >
          Refine Results
        </button>
        <button className="secondary-btn" onClick={() => navigate("/")}>
          Analyze Another Photo
        </button>
      </motion.div>
    </motion.main>
  );
}

export default SkinResult;
