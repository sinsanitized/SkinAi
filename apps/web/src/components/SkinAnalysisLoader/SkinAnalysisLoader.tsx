import React from "react";
import styles from "./SkinAnalysisLoader.module.css";

const SkinAnalysisLoader: React.FC = () => {
  return (
    <div
      className={styles.loaderContainer}
      role="status"
      aria-live="polite"
      aria-label="Analyzing your skin and building a routine"
    >
      <div className={styles.loader} aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p>🔍 Analyzing your skin and building a routine... </p>
    </div>
  );
};

export default SkinAnalysisLoader;
