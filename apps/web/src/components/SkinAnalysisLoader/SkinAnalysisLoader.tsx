import React, { useEffect, useState } from "react";
import styles from "./SkinAnalysisLoader.module.css";

const LOADING_STAGES = [
  "Analyzing input...",
  "Retrieving relevant data...",
  "Generating recommendations...",
] as const;

const SkinAnalysisLoader: React.FC = () => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStageIndex((currentStage) =>
        currentStage < LOADING_STAGES.length - 1 ? currentStage + 1 : currentStage
      );
    }, 1100);

    return () => window.clearInterval(intervalId);
  }, []);

  const progress = ((stageIndex + 1) / LOADING_STAGES.length) * 100;

  return (
    <div
      className={styles.loaderContainer}
      role="status"
      aria-live="polite"
      aria-label={LOADING_STAGES[stageIndex]}
    >
      <div className={styles.loaderHeader}>
        <p className={styles.kicker}>Skin analysis in progress</p>
        <h2>Building your routine</h2>
        <p className={styles.stage}>{LOADING_STAGES[stageIndex]}</p>
      </div>

      <div className={styles.loader} aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className={styles.stageList} aria-hidden="true">
        {LOADING_STAGES.map((stage, index) => (
          <li
            key={stage}
            className={index <= stageIndex ? styles.stageActive : undefined}
          >
            {stage}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SkinAnalysisLoader;
