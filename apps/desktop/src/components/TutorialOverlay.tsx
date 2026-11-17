import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react';
import {
  getTutorialStepsForAccount,
  type AppSectionId,
  type FarmAccount,
} from '@farmdb/core';
import { APP_ICONS } from '../assets/icons';

interface TutorialOverlayProps {
  visible: boolean;
  activeAccount: FarmAccount | null | undefined;
  activeSection: AppSectionId;
  onClose: () => void;
}

export function TutorialOverlay({
  visible,
  activeAccount,
  activeSection,
  onClose,
}: TutorialOverlayProps) {
  const steps = useMemo(
    () => getTutorialStepsForAccount(activeAccount),
    [activeAccount]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const matchIdx = steps.findIndex((s) => s.targetSection === activeSection);
    setStepIndex(matchIdx >= 0 ? matchIdx : 0);
  }, [visible, activeSection, steps]);

  useEffect(() => {
    if (!visible) return;
    if (scrollBodyRef.current) {
      scrollBodyRef.current.scrollTop = 0;
    }
  }, [visible, stepIndex]);

  useEffect(() => {
    if (!visible) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  const currentStep = steps[stepIndex] ?? steps[0];

  if (!visible || !currentStep) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div
      className="tutorial-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="farmDB Complete App Guide"
    >
      <div className="tutorial-modal">
        <aside className="tutorial-sidebar">
          <div className="tutorial-sidebar-brand">
            <div className="brand-mark">
              <img src={APP_ICONS.barn} alt="" />
            </div>
            <div>
              <strong style={{ display: 'block', color: '#ffffff', fontSize: '0.96rem' }}>
                farmDB Guide
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#b7e4c7' }}>
                {steps.length} Sections
              </span>
            </div>
          </div>

          <div className="tutorial-chapter-list">
            {steps.map((step, idx) => {
              const active = idx === stepIndex;
              const visited = idx < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`tutorial-chapter-btn ${active ? 'is-active' : ''} ${visited ? 'is-visited' : ''}`}
                  onClick={() => setStepIndex(idx)}
                >
                  <span className="tutorial-chapter-num">{idx + 1}</span>
                  <span className="tutorial-chapter-title">{step.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="tutorial-content-pane">
          <div className="tutorial-top-bar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="tutorial-badge">
                  <BookOpen size={13} />
                  Guide {stepIndex + 1} of {steps.length} · {currentStep.category}
                </span>
                {currentStep.adminOnly && (
                  <span className="tutorial-admin-pill">Admin Feature</span>
                )}
              </div>
              <h2 className="tutorial-title">{currentStep.title}</h2>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
              onClick={onClose}
              aria-label="Close guide"
            >
              <X size={16} />
              Exit Guide
            </button>
          </div>

          <div className="tutorial-progress-track" aria-hidden="true">
            <div
              className="tutorial-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div ref={scrollBodyRef} className="tutorial-scroll-body">
            <div className="tutorial-summary-card">
              <strong className="tutorial-section-heading">In Simple Words</strong>
              <p className="tutorial-summary-text">{currentStep.summary}</p>
            </div>

            <div>
              <h3 className="tutorial-section-heading">
                Cards, Buttons &amp; Fields Explained
              </h3>
              <div className="tutorial-features-grid">
                {currentStep.cardsAndFeatures.map((feat) => (
                  <div key={feat.name} className="tutorial-feature-card">
                    <strong>{feat.name}</strong>
                    <p>{feat.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="tutorial-section-heading">How to Use It Step-by-Step</h3>
              <div className="tutorial-steps-list">
                {currentStep.howToSteps.map((line, i) => (
                  <div key={line} className="tutorial-step-row">
                    <span className="tutorial-step-circle">{i + 1}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="tutorial-tip-box">
              <Lightbulb size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Helpful Farm Tip</strong>
                <p>{currentStep.proTip}</p>
              </div>
            </div>
          </div>

          <div className="tutorial-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isFirst}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {progressPercent}% read
            </span>

            {isLast ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
              >
                Finish Guide
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
                }
              >
                Next Section
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
