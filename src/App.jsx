
import { useState } from "react";
import "./App.css";

function App() {
  const [notes, setNotes] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeCard, setActiveCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mode, setMode] = useState("flashcards");
  const [answers, setAnswers] = useState({});

  async function generateStudyMaterial() {
    if (!notes.trim()) {
      setError("Please enter your study notes first.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);
    setAnswers({});
    setActiveCard(0);
    setShowAnswer(false);

    try {
      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Generation failed.");
      }

      if (
        !result ||
        !result.title ||
        !Array.isArray(result.flashcards) ||
        !Array.isArray(result.quiz) ||
        result.flashcards.length < 1 ||
        result.quiz.length < 1
      ) {
        throw new Error("Invalid study material received.");
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Unable to connect to AI server.");
    } finally {
      setLoading(false);
    }
  }

  function nextCard() {
    setActiveCard((current) =>
      Math.min(current + 1, data.flashcards.length - 1)
    );
    setShowAnswer(false);
  }

  function previousCard() {
    setActiveCard((current) => Math.max(current - 1, 0));
    setShowAnswer(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">✦</span>
          <span>StudySpark</span>
        </div>
        <span className="top-label">AI POWERED LEARNING</span>
      </header>

      <main className="container">
        <section className="hero">
          <span className="eyebrow">YOUR PERSONAL AI STUDY PARTNER</span>
          <h1>Learn smarter.<br /><span>Remember longer.</span></h1>
          <p>
            Turn your study notes into interactive flashcards
            and quizzes in seconds.
          </p>
        </section>

        <section className="input-panel">
          <div className="section-heading">
            <div>
              <h2>What are you studying today?</h2>
              <p>Paste your notes or enter any topic below.</p>
            </div>
            <span className="step-number">01 / INPUT</span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your study notes here..."
            rows={7}
          />

          <div className="input-footer">
            <span>{notes.length} characters</span>
            <button
              className="generate-btn"
              onClick={generateStudyMaterial}
              disabled={loading}
            >
              {loading ? "Generating..." : "✦ Generate study material"}
            </button>
          </div>

          {loading && (
            <p className="loading-message">
              AI is preparing your flashcards and quiz...
            </p>
          )}

          {error && (
            <div className="error-message" role="alert">
              {error}
              <button onClick={generateStudyMaterial}>Retry</button>
            </div>
          )}
        </section>

        {data && (
          <section className="results-section">
            <div className="results-heading">
              <div>
                <span className="eyebrow">YOUR STUDY MATERIAL</span>
                <h2>{data.title}</h2>
              </div>
              <span className="success-label">✓ Generated</span>
            </div>

            <div className="tabs">
              <button
                className={mode === "flashcards" ? "active" : ""}
                onClick={() => setMode("flashcards")}
              >
                Flashcards ({data.flashcards.length})
              </button>
              <button
                className={mode === "quiz" ? "active" : ""}
                onClick={() => setMode("quiz")}
              >
                Quiz ({data.quiz.length})
              </button>
            </div>

            {mode === "flashcards" && (
              <div className="study-card">
                <div className="card-counter">
                  CARD {activeCard + 1} OF {data.flashcards.length}
                </div>

                <h3>
                  {showAnswer
                    ? data.flashcards[activeCard].answer
                    : data.flashcards[activeCard].question}
                </h3>

                <button
                  className="reveal-btn"
                  onClick={() => setShowAnswer(!showAnswer)}
                >
                  {showAnswer ? "Show question" : "Reveal answer"}
                </button>

                <div className="card-navigation">
                  <button
                    onClick={previousCard}
                    disabled={activeCard === 0}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={nextCard}
                    disabled={activeCard === data.flashcards.length - 1}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {mode === "quiz" && (
              <div className="quiz-list">
                {data.quiz.map((item, index) => (
                  <div className="quiz-card" key={index}>
                    <h3>{index + 1}. {item.question}</h3>

                    {item.options.map((option, optionIndex) => (
                      <label className="option" key={optionIndex}>
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={answers[index] === option}
                          onChange={() =>
                            setAnswers((previous) => ({
                              ...previous,
                              [index]: option,
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}

                    {answers[index] && (
                      <p className="answer-feedback">
                        {answers[index].trim().toLowerCase() ===
                        item.answer.trim().toLowerCase()
                          ? "✓ Correct answer!"
                          : "Not quite. Correct answer: " + item.answer}
                      </p>
                    )}

                    {item.explanation && (
                      <p className="explanation">{item.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer>
        StudySpark · Learn at your own pace.
      </footer>
    </div>
  );
}

export default App;
