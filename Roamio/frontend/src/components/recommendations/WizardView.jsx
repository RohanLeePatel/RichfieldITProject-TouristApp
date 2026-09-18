import { ArrowRight, ChevronLeft, LoaderCircle } from "lucide-react";

import { steps } from "../../pages/recommendations/constants.js";
import TripSummary from "./TripSummary.jsx";
import BasicsStep from "./steps/BasicsStep.jsx";
import GroupStep from "./steps/GroupStep.jsx";
import InterestsStep from "./steps/InterestsStep.jsx";
import ReviewStep from "./steps/ReviewStep.jsx";

// Layout: a column of separate cards (progress, then each step's panels,
// then the actions bar) beside a live "trip so far" summary card.
export default function WizardView({ step, setStep, error, setError, loading, onNext, ...stepProps }) {
  const goToStep = (target) => {
    setError("");
    setStep(target);
  };
  return (
    <section className="wizard-card">
      <div className="wizard-main">
        <ol className="panel wizard-progress" aria-label="Progress">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`wizard-step ${index < step ? "done" : ""} ${index === step ? "current" : ""}`}
              aria-current={index === step ? "step" : undefined}
            >
              <i />
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && <BasicsStep {...stepProps} />}
        {step === 1 && <InterestsStep {...stepProps} />}
        {step === 2 && <GroupStep {...stepProps} />}
        {step === 3 && <ReviewStep form={stepProps.form} goToStep={goToStep} />}

        {error && <p className="recommendations-error" role="alert">{error}</p>}
        <div className="panel wizard-actions">
          {step > 0 && (
            <button type="button" className="secondary-button" onClick={() => goToStep(step - 1)}>
              <ChevronLeft size={17} /> Back
            </button>
          )}
          <button type="button" className="recommendations-submit" onClick={onNext} disabled={loading}>
            {loading ? (
              <><LoaderCircle className="recommendations-spinner" size={18} /> Finding matches...</>
            ) : (
              <>{step === steps.length - 1 ? "Find my matches" : "Continue"} <ArrowRight size={17} /></>
            )}
          </button>
        </div>
      </div>
      <TripSummary form={stepProps.form} />
    </section>
  );
}
