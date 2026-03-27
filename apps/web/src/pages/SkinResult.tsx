import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import type {
  EscalationAssessment,
  IngredientConflict,
  IngredientRecommendation,
  ProductRecommendation,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
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
    return { percent, label: "High confidence", toneClassName: "confidenceHigh" };
  }

  if (percent >= 50) {
    return {
      percent,
      label: "Medium confidence",
      toneClassName: "confidenceMedium",
    };
  }

  return { percent, label: "Low confidence", toneClassName: "confidenceLow" };
}

function isFallbackAnalysis(analysis: SkinAnalysisResponse) {
  return analysis.disclaimers?.some((disclaimer) =>
    disclaimer.toLowerCase().includes("fallback response")
  );
}

function buildWhyRecommendation(
  analysis: SkinAnalysisResponse,
  explanation?: SkinEducation
) {
  if (explanation?.skinTypeExplanation?.trim()) {
    return explanation.skinTypeExplanation;
  }

  const concern = analysis.concerns?.[0]?.name?.toLowerCase();
  const ingredient = analysis.ingredients?.[0]?.ingredient;

  if (concern && ingredient) {
    return `These recommendations focus on ${concern} while using ${ingredient} to support a simpler, more targeted routine.`;
  }

  if (concern) {
    return `These recommendations are designed to support ${concern} with a routine that is easier to follow consistently.`;
  }

  return "These recommendations are structured to keep the routine simple, readable, and easier to follow.";
}

function getEscalationMeta(escalation?: EscalationAssessment) {
  const level = escalation?.level ?? "none";

  if (level === "medical_review") {
    return {
      toneClassName: "escalationMedical",
      heading: "Medical Review Recommended",
      copy:
        escalation?.reason ||
        "Visible severity may be beyond what an over-the-counter skincare routine can reliably address.",
    };
  }

  if (level === "monitor") {
    return {
      toneClassName: "escalationMonitor",
      heading: "Closer Monitoring Advised",
      copy:
        escalation?.reason ||
        "A cautious routine is appropriate, and the skin should be monitored closely for worsening or lack of improvement.",
    };
  }

  return null;
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
  const whyRecommendation = buildWhyRecommendation(analysis, explanation);
  const escalationMeta = getEscalationMeta(analysis.escalation);
  const isMedicalReview = analysis.escalation?.level === "medical_review";

  const reveal = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.18 : 0.36,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  return (
    <motion.main
      className="resultPage"
      initial="hidden"
      animate="visible"
      variants={reveal}
    >
      <motion.section className="resultsCard" variants={reveal}>
        <header className="resultsHeader">
          <p className="resultsEyebrow">SkinAI Results</p>
          <h1 className="resultsTitle">
            {isMedicalReview ? "Supportive care plan" : "Your skincare plan"}
          </h1>
          <p className="resultsIntro">
            {isMedicalReview
              ? "This result stays conservative because the visible severity may be beyond what a standard skincare routine should try to handle alone."
              : "A structured summary of the visible concerns, routine steps, and ingredients worth focusing on."}
          </p>
        </header>

        {fallbackAnalysis ? (
          <div className="resultsWarning" role="alert" aria-live="polite">
            ⚠️ Unable to analyze input. Try adding more detail.
          </div>
        ) : null}

        {escalationMeta ? (
          <section
            className={`resultSection escalationCard ${escalationMeta.toneClassName}`}
            role="alert"
            aria-live="polite"
          >
            <h2>{escalationMeta.heading}</h2>
            <p>{escalationMeta.copy}</p>
            {isMedicalReview ? (
              <p className="escalationSubcopy">
                The routine below is intentionally supportive and low-risk. It
                is not trying to aggressively treat the condition at home.
              </p>
            ) : null}
          </section>
        ) : null}

        {imageDataUrl ? (
          <section className="resultSection resultSectionPhoto">
            <h2>Uploaded Photo</h2>
            <img
              src={imageDataUrl}
              alt="Uploaded face photo used for skin analysis"
              className="resultPhoto"
            />
          </section>
        ) : null}

        <section className="resultSection">
          <h2>Skin Analysis</h2>
          <div className="detailList">
            <div className="detailRow">
              <span className="detailLabel">Condition</span>
              <span className="detailValue">
                {primaryConcern?.name || analysis.skinType.type}
              </span>
            </div>
            <div className="detailRow">
              <span className="detailLabel">Severity</span>
              <span className="detailValue">
                {primaryConcern?.severity || "Moderate"}
              </span>
            </div>
            <div className="detailRow">
              <span className="detailLabel">Escalation</span>
              <span className="detailValue">
                {analysis.escalation?.level === "medical_review"
                  ? "Medical review"
                  : analysis.escalation?.level === "monitor"
                    ? "Monitor closely"
                    : "None"}
              </span>
            </div>
          </div>
        </section>

        <section className="resultSection">
          <h2>Morning Routine</h2>
          {analysis.routine?.AM?.length ? (
            <ol className="routineList">
              {analysis.routine.AM.map((step: string, index: number) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="emptyCopy">
              No morning routine steps were returned for this result.
            </p>
          )}
        </section>

        <section className="resultSection">
          <h2>Night Routine</h2>
          {analysis.routine?.PM?.length ? (
            <ol className="routineList">
              {analysis.routine.PM.map((step: string, index: number) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="emptyCopy">
              No night routine steps were returned for this result.
            </p>
          )}
          {analysis.routine?.weekly?.length ? (
            <div className="weeklyBlock">
              <h3>Weekly cadence</h3>
              <ul className="supportList">
                {analysis.routine.weekly.map((step: string, index: number) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="resultSection">
          <h2>Key Ingredients</h2>
          {analysis.ingredients?.length ? (
            <div className="chipGroup">
              {analysis.ingredients.map(
                (ingredient: IngredientRecommendation, index: number) => (
                  <span key={index} className="ingredientChip">
                    {ingredient.ingredient}
                  </span>
                )
              )}
            </div>
          ) : (
            <p className="emptyCopy">
              No specific ingredient recommendations were returned.
            </p>
          )}
        </section>

        <section className="resultSection">
          <h2>Confidence</h2>
          <div className={`confidenceCard ${confidence.toneClassName}`}>
            <div className="confidenceText">
              {confidence.percent}% - {confidence.label}
            </div>
            <div
              className="confidenceBar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={confidence.percent}
              aria-label={`${confidence.percent}% confidence`}
            >
              <div
                className="confidenceBarFill"
                style={{ width: `${confidence.percent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="resultSection">
          <h2>Why This Recommendation</h2>
          <p className="whyCopy">{whyRecommendation}</p>
          {explanation?.productBenefits?.length ? (
            <ul className="supportList">
              {explanation.productBenefits.slice(0, 3).map((benefit, index) => (
                <li key={index}>{benefit}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {analysis.products?.length ? (
          <section className="resultSection">
            <h2>Product Picks</h2>
            <ul className="supportList">
              {analysis.products
                .slice(0, 4)
                .map((product: ProductRecommendation, index: number) => (
                  <li key={index}>
                    <strong>
                      {product.brand ? `${product.brand} - ` : ""}
                      {product.name}
                    </strong>
                    {` - ${product.why}`}
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        {analysis.conflicts?.length || analysis.disclaimers?.length ? (
          <section className="resultSection resultSectionMuted">
            <h2>Notes</h2>
            {analysis.conflicts?.length ? (
              <ul className="supportList">
                {analysis.conflicts.map(
                  (conflict: IngredientConflict, index: number) => (
                    <li key={index}>
                      <strong>{conflict.ingredients.join(" + ")}</strong>
                      {` - ${conflict.warning}`}
                    </li>
                  )
                )}
              </ul>
            ) : null}
            {analysis.disclaimers?.length ? (
              <ul className="supportList mutedList">
                {analysis.disclaimers.map((disclaimer: string, index: number) => (
                  <li key={index}>{disclaimer}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <footer className="resultsFooter">
          <div className="resultActions">
            <button className="start-over-btn" onClick={() => navigate("/")}>
              Analyze Another Photo
            </button>
          </div>
        </footer>
      </motion.section>
    </motion.main>
  );
}

export default SkinResult;
