import { useState, useEffect } from 'react';
import styles from '../styles/VideoQuiz.module.css';

export default function VideoQuiz({ 
  videoId,
  transcript, 
  summary,
  onQuizComplete,
  onPauseVideo,
  onResumeVideo,
  isActive,
  currentTime = 0,
  config = {},
  onNextQuestion,
  onSeek,
  playerRef
}) {
  // Basic state
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [processedTimestamps, setProcessedTimestamps] = useState({});
  const [missedQuestions, setMissedQuestions] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  
  const [quizConfig, setQuizConfig] = useState({
    difficulty: config.difficulty || 'medium',
    questionCount: config.questionCount || 5,
    includeExplanations: config.includeExplanations !== false
  });

  // Add logging for current time updates
  useEffect(() => {
    if (isActive && currentTime > 0) {
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      console.log(`🎯 QUIZ: VideoQuiz received time update: ${minutes}:${seconds.toString().padStart(2, '0')} (${currentTime.toFixed(2)}s)`);
    }
  }, [currentTime, isActive]);

  // Add logging when component mounts and when isActive changes
  useEffect(() => {
    console.log(`🎯 QUIZ: VideoQuiz component mounted/updated:`, {
      isActive,
      currentTime: currentTime.toFixed(2),
      hasTranscript: transcript && transcript.length > 0,
      transcriptLength: transcript?.length || 0
    });
  }, [isActive, currentTime, transcript]);

  // Show configuration panel when quiz mode is activated and transcript is loaded
  useEffect(() => {
    if (transcript && transcript.length > 0 && isActive && !quizStarted) {
      setShowConfigPanel(true);
      // Pause the video immediately when entering quiz mode
      if (onPauseVideo) {
        console.log("🎯 QUIZ: Pausing video while entering quiz mode");
        onPauseVideo();
      }
    }
  }, [transcript, isActive, onPauseVideo, quizStarted]);

  // Handle starting the quiz and generating questions
  const handleStartQuiz = async () => {
    setShowConfigPanel(false);
    setLoading(true);
    setError(null);
    setQuizStarted(true);
    console.log("🎯 QUIZ: Generating questions...");

    try {
      const res = await fetch('/api/youtube/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          transcript,
          summary,
          config: quizConfig,
        }),
      });

      const data = await res.json();

      if (data.success && data.questions && data.questions.length > 0) {
        console.log(`🎯 QUIZ: Successfully generated ${data.questions.length} questions.`);
        setQuestions(data.questions);
        if (onResumeVideo) {
          console.log("🎯 QUIZ: Resuming video after generating questions.");
          onResumeVideo();
        }
      } else {
        console.error('🎯 QUIZ: Failed to generate questions:', data.message);
        setError(data.message || 'Failed to generate quiz questions.');
      }
    } catch (err) {
      console.error('🎯 QUIZ: Error generating quiz:', err);
      setError('An error occurred while generating the quiz.');
    } finally {
      setLoading(false);
    }
  };

  // Check for questions that should be shown based on current time
  useEffect(() => {
    if (!isActive || loading || showQuestion || questions.length === 0) {
      return;
    }

    // Find the next unanswered question, ensuring they are sorted by timestamp
    const nextUnansweredQ = questions
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
      .find(q => !selectedAnswers.hasOwnProperty(q.id));

    // If there is a next question, tell the player when to pause
    if (nextUnansweredQ) {
      if (onNextQuestion) {
        onNextQuestion(nextUnansweredQ.timestamp);
      }

      // If it's time to show this question, trigger the modal and pause the video
      if (currentTime >= Number(nextUnansweredQ.timestamp)) {
        console.log(`🎯 QUIZ: Triggering question at ${currentTime.toFixed(2)}s: "${nextUnansweredQ.question.substring(0, 100)}..."`);
        
        const questionIndex = questions.findIndex(q => q.id === nextUnansweredQ.id);
        
        setActiveQuestion(nextUnansweredQ);
        setCurrentQuestion(questionIndex >= 0 ? questionIndex : 0);
        setShowQuestion(true);
        
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      }
    } else {
      // No more questions, so ensure no more pausing
      if (onNextQuestion) {
        onNextQuestion(null);
      }
    }
  }, [isActive, currentTime, loading, questions, showQuestion, selectedAnswers, onPauseVideo, onNextQuestion]);

  // Handle continuing after seeing quiz results
  const handleContinue = () => {
    console.log("🎯 QUIZ: Quiz completed");
    console.log("Final score:", quizResult ? quizResult.score : "no result");
    console.log("Resetting quiz state and resuming video...");
    
    // Reset quiz state
    setQuizResult(null);
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowQuestion(false);
    setActiveQuestion(null);
    
    // Resume video playback
    if (onResumeVideo) {
      console.log("🎯 QUIZ: Resuming video playback");
      onResumeVideo();
    } else {
      console.warn("🎯 QUIZ: Cannot resume video - onResumeVideo function not provided");
    }
  };

  // Handle option selection
  const handleSelectAnswer = (questionId, optionId) => {
    console.log(`🎯 QUIZ: Selected answer ${optionId} for question ${questionId}`);
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionId
    });
  };

  // Handle submitting an answer
  const handleSubmitAnswer = () => {
    const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestion] : null);
    if (!currentQ) {
      console.error('🎯 QUIZ: No active question to submit');
      return;
    }
    
    const selectedOption = selectedAnswers[currentQ.id];
    if (!selectedOption) {
      console.error('🎯 QUIZ: No answer selected');
      return;
    }
    
    // Check if answer is correct
    const isCorrect = selectedOption === currentQ.correctAnswer || 
      (Array.isArray(currentQ.correctAnswer) && 
       Array.isArray(selectedOption) && 
       currentQ.correctAnswer.every(ans => selectedOption.includes(ans)));
    
    setAnswerCorrect(isCorrect);
    console.log(`🎯 QUIZ: Answer submitted: ${isCorrect ? 'Correct!' : 'Incorrect'}`);
    
    // Show feedback if explanations are enabled
    if (quizConfig.includeExplanations) {
      setShowFeedback(true);
    } else {
      // If there's no explanation or explanations are disabled, proceed
      handleContinueToNextQuestion();
    }
  };
  
  // Handle retrying a question after getting it wrong
  const handleTryAgain = () => {
    const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestion] : null);
    if (!currentQ) return;

    console.log(`🎯 QUIZ: User is retrying question ${currentQ.id}`);
    
    // Clear the previous incorrect answer
    setSelectedAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQ.id];
      return newAnswers;
    });

    // Hide the feedback panel and show the options again
    setShowFeedback(false);
  };

  // Continue to the next question or finish quiz
  const handleContinueToNextQuestion = () => {
    console.log("🎯 QUIZ: Continuing to next question");
    setShowFeedback(false);
    
    // If this is the last question, calculate the final score
    if (currentQuestion === questions.length - 1 || 
        (activeQuestion && !questions.some(q => q.id !== activeQuestion.id))) {
      console.log("🎯 QUIZ: This was the last question - calculating final score...");
      
      // Calculate score based on answered questions
      const answeredCount = Object.keys(selectedAnswers).length;
      const correctCount = Object.keys(selectedAnswers).filter(qId => {
        const question = questions.find(q => q.id === qId) || activeQuestion;
        if (!question) return false;
        
        const selected = selectedAnswers[qId];
        const correct = question.correctAnswer;
        
        if (Array.isArray(correct)) {
          return Array.isArray(selected) && 
            correct.every(ans => selected.includes(ans));
        }
        return selected === correct;
      }).length;
      
      const score = (correctCount / Math.max(1, answeredCount)) * 100;
      console.log(`🎯 QUIZ: Final score: ${score.toFixed(1)}% (${correctCount}/${answeredCount} correct)`);
      
      setQuizResult({
        score,
        correctAnswers: correctCount,
        totalQuestions: answeredCount
      });
      
      // Notify parent component that quiz is complete
      if (onQuizComplete) {
        console.log("🎯 QUIZ: Notifying parent that quiz is complete");
        onQuizComplete({
          score,
          correctAnswers: correctCount,
          totalQuestions: answeredCount
        });
      }
    } else {
      // Move to the next question
      console.log(`🎯 QUIZ: Moving to next question`);
      setCurrentQuestion(currentQuestion + 1);
      
      // Resume the video after answering a question
      if (onSeek) {
        onSeek(activeQuestion.timestamp);
      }
      console.log("🎯 QUIZ: Hiding current question and resuming video");
      setShowQuestion(false);
      setActiveQuestion(null);
      
      if (onResumeVideo) {
        console.log("🎯 QUIZ: Resuming video playback");
        onResumeVideo();
      } else {
        console.warn("🎯 QUIZ: Cannot resume video - onResumeVideo function not provided");
      }
    }
  };

  // Handle configuration changes
  const handleConfigChange = (field, value) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Don't render anything if quiz mode is not active
  if (!isActive) {
    // Show background generation indicator when not in quiz mode
    if (loading) {
      return (
        <div className={styles.generatingIndicator}>
          <div className={styles.miniSpinner}></div>
          <span>Preparing quiz...</span>
        </div>
      );
    }
    return null;
  }
  
  // Show configuration panel
  if (showConfigPanel) {
    return (
      <div className={styles.quizOverlay}>
        <div className={styles.quizContainer}>
          <div className={styles.questionHeader}>
            <span>Quiz Configuration</span>
          </div>
          
          <div className={styles.questionContent}>
            <h2 className={styles.question}>Configure Your Quiz</h2>
            
            <div className={styles.configSection}>
              <label>Difficulty Level:</label>
              <div className={styles.configOptions}>
                {['easy', 'medium', 'hard'].map((level) => (
                  <button 
                    key={level}
                    className={`${styles.configOption} ${quizConfig.difficulty === level ? styles.selected : ''}`}
                    onClick={() => handleConfigChange('difficulty', level)}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={styles.configSection}>
              <label>Number of Questions:</label>
              <div className={styles.configOptions}>
                {[3, 5, 7, 10].map((count) => (
                  <button 
                    key={count}
                    className={`${styles.configOption} ${quizConfig.questionCount === count ? styles.selected : ''}`}
                    onClick={() => handleConfigChange('questionCount', count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={styles.configSection}>
              <label>Include Explanations:</label>
              <div className={styles.configOptions}>
                <button 
                  className={`${styles.configOption} ${quizConfig.includeExplanations ? styles.selected : ''}`}
                  onClick={() => handleConfigChange('includeExplanations', true)}
                >
                  Yes
                </button>
                <button 
                  className={`${styles.configOption} ${!quizConfig.includeExplanations ? styles.selected : ''}`}
                  onClick={() => handleConfigChange('includeExplanations', false)}
                >
                  No
                </button>
              </div>
            </div>
            
            <button 
              className={styles.submitButton}
              onClick={handleStartQuiz}
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state when in quiz mode
  if (loading) {
    // Ensure video stays paused during loading
    if (onPauseVideo) {
      console.log("🎯 QUIZ: Keeping video paused while loading quiz questions");
      onPauseVideo();
    }
    return (
      <div className={styles.quizOverlay}>
        <div className={styles.quizContainer}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Generating quiz questions...</p>
            <div className={styles.progressContainer}>
              <div 
                className={styles.progressBar} 
                style={{ width: `${generationProgress}%` }}
              ></div>
              <span>{generationProgress}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    // Ensure video stays paused even if there's an error
    if (onPauseVideo) {
      console.log("🎯 QUIZ: Keeping video paused while showing error");
      onPauseVideo();
    }
    return (
      <div className={styles.quizOverlay}>
        <div className={styles.quizContainer}>
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz results
  if (quizResult) {
    return (
      <div className={styles.quizOverlay}>
        <div className={styles.quizContainer}>
          <div className={styles.quizResults}>
            <h2>Quiz Complete!</h2>
            <div className={styles.scoreDisplay}>
              <div className={styles.scoreCircle}>
                <span className={styles.scoreNumber}>{Math.round(quizResult.score)}%</span>
              </div>
            </div>
            <p>You answered {quizResult.correctAnswers} out of {quizResult.totalQuestions} questions correctly.</p>
            <button className={styles.continueButton} onClick={handleContinue}>
              Continue Watching
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show current question
  if (showQuestion) {
    const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestion] : null);
    
    if (!currentQ) {
      console.error('🎯 QUIZ: No question to show');
      return null;
    }
    
    const selectedOptionId = selectedAnswers[currentQ.id];
    const selectedOption = currentQ.options.find(opt => opt.id === selectedOptionId);
    
    return (
      <div className={styles.quizOverlay}>
        <div className={styles.quizContainer}>
          <div className={styles.questionHeader}>
            <span className={styles.questionNumber}>
              Question {currentQuestion + 1} of {Math.max(1, questions.length)}
            </span>
            {currentQ.timestamp && (
              <span className={styles.questionTimestamp}>
                @{Math.floor(Number(currentQ.timestamp) / 60)}:{String(Math.floor(Number(currentQ.timestamp) % 60)).padStart(2, '0')}
              </span>
            )}
          </div>
          
          <div className={styles.questionContent}>
            <h2 className={styles.question}>{currentQ.question}</h2>
            
            {showFeedback ? (
              <div className={`${styles.feedbackPanel} ${answerCorrect ? styles.correct : styles.incorrect}`}>
                <div className={styles.feedbackHeader}>
                  {answerCorrect ? (
                    <>
                      <span className={styles.feedbackIcon}>✓</span>
                      <span>Correct!</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.feedbackIcon}>✗</span>
                      <span>Incorrect</span>
                    </>
                  )}
                </div>
                
                <div className={styles.explanation}>
                  {selectedOption?.explanation}
                </div>
                
                <button 
                  className={styles.continueButton}
                  onClick={answerCorrect ? handleContinueToNextQuestion : handleTryAgain}
                >
                  {answerCorrect
                    ? (currentQuestion === questions.length - 1 ? 'Finish Quiz' : 'Next Question')
                    : 'Try Again'}
                </button>
              </div>
            ) : (
              <>
                <div className={styles.options}>
                  {currentQ.options?.map(option => (
                    <div 
                      key={option.id}
                      className={`${styles.option} ${selectedAnswers[currentQ.id] === option.id ? styles.selected : ''}`}
                      onClick={() => handleSelectAnswer(currentQ.id, option.id)}
                    >
                      <span className={styles.optionLabel}>{option.id.toUpperCase()}</span>
                      <span className={styles.optionText}>{option.text}</span>
                    </div>
                  ))}
                </div>
                
                <button 
                  className={styles.submitButton}
                  disabled={!selectedAnswers[currentQ.id]} 
                  onClick={handleSubmitAnswer}
                >
                  Check Answer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Return empty div by default when in quiz mode but no question is showing
  return (
    <div className={styles.quizModeActive}>
      <div className={styles.quizInstructions}>
        <p>Quiz Mode Active. Questions will appear at key points in the video.</p>
      </div>
    </div>
  );
}