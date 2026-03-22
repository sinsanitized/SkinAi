import React from "react";
import styles from "./SkinAnalysisLoader.module.css";

const SkinAnalysisLoader: React.FC = () => {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.loader}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p>🔍 Analyzing your skin and building a routine... </p>
    </div>
  );
};

export default SkinAnalysisLoader;
