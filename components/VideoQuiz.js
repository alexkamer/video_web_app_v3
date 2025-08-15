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
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const [nextQuestionTime, setNextQuestionTime] = useState(null);
  const [showQuestionIndicator, setShowQuestionIndicator] = useState(false);
  const [shownQuestions, setShownQuestions] = useState(new Set()); // Track which questions have been shown
  
  console.log(`🎯 QUIZ: Component render - isActive: ${isActive}, showQuestion: ${showQuestion}, questions: ${questions.length}`);
  
  const [quizConfig, setQuizConfig] = useState({
    difficulty: config.difficulty || 'medium',
    contentDensity: config.contentDensity || 'medium',
    includeExplanations: config.includeExplanations !== false
  });

  // Add logging for current time updates
  useEffect(() => {
    if (isActive) {
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      console.log(`🎯 QUIZ: VideoQuiz received time update: ${minutes}:${seconds.toString().padStart(2, '0')} (${currentTime.toFixed(2)}s)`);
    }
  }, [currentTime, isActive]);

  // Add logging for showQuestion state changes
  useEffect(() => {
    console.log(`🎯 QUIZ: showQuestion state changed to: ${showQuestion}`);
  }, [showQuestion]);

  // Add logging for activeQuestion state changes
  useEffect(() => {
    console.log(`🎯 QUIZ: activeQuestion state changed to:`, activeQuestion ? `ID ${activeQuestion.id}` : 'null');
  }, [activeQuestion]);

  // Add logging for questions state
  useEffect(() => {
    if (questions.length > 0) {
      console.log(`🎯 QUIZ: Questions loaded:`, questions.length);
      questions.forEach((q, i) => {
        const roundedTime = Math.round(q.timestamp);
        console.log(`🎯 QUIZ: Question ${i + 1} at ${q.timestamp}s (rounded to ${roundedTime}s): "${q.question.substring(0, 50)}..."`);
        console.log(`🎯 QUIZ: Question ${i + 1} type: ${isMultipleChoiceQuestion(q) ? 'Multiple Choice' : 'Single Choice'}`);
      });
      
      // REMOVED: Test timeout that was causing repeated question display
    }
      }, [questions, isActive, showQuestion]);

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
    console.log(`🎯 QUIZ: Config panel check:`, {
      hasTranscript: transcript && transcript.length > 0,
      isActive,
      quizStarted,
      transcriptLength: transcript?.length || 0
    });
    
    if (transcript && transcript.length > 0 && isActive && !quizStarted) {
      console.log("🎯 QUIZ: Showing configuration panel");
      setShowConfigPanel(true);
      // Video should continue playing normally - no automatic pausing
    }
  }, [transcript, isActive, quizStarted]);

  // Handle starting the quiz and generating questions
  const handleStartQuiz = async () => {
    setShowConfigPanel(false);
    setLoading(true);
    setError(null);
    setQuizStarted(true);
    setShownQuestions(new Set()); // Reset shown questions when starting quiz
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
        // Video should continue playing normally - no automatic resuming
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
    console.log(`🎯 QUIZ: Question check effect - isActive: ${isActive}, loading: ${loading}, showQuestion: ${showQuestion}, questions: ${questions.length}`);
    
    if (!isActive || loading || showQuestion || questions.length === 0) {
      console.log(`🎯 QUIZ: Skipping question check - isActive: ${isActive}, loading: ${loading}, showQuestion: ${showQuestion}, questions: ${questions.length}`);
      return;
    }

    // Add debugging for current time and questions
    console.log(`🎯 QUIZ: Checking questions at ${currentTime.toFixed(2)}s, questions:`, questions.length);

    // Debounce checks to prevent excessive re-renders
    const timeSinceLastCheck = currentTime - lastCheckTime;
    if (timeSinceLastCheck < 0.5) { // Only check every 0.5 seconds
      return;
    }
    setLastCheckTime(currentTime);

    // Find the next unanswered question, ensuring they are sorted by timestamp
    // Only show questions that haven't been answered yet and haven't been shown yet
    console.log(`🎯 QUIZ: Current selectedAnswers:`, selectedAnswers);
    console.log(`🎯 QUIZ: Shown questions:`, Array.from(shownQuestions));
    const nextUnansweredQ = questions
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
      .find(q => !selectedAnswers.hasOwnProperty(q.id) && !shownQuestions.has(q.id));
    
    console.log(`🎯 QUIZ: Next unanswered question:`, nextUnansweredQ ? `ID ${nextUnansweredQ.id} at ${nextUnansweredQ.timestamp}s` : 'None');

    // If there is a next question, tell the player when to pause
    if (nextUnansweredQ) {
      const questionTime = Number(nextUnansweredQ.timestamp);
      setNextQuestionTime(questionTime);
      
      if (onNextQuestion) {
        onNextQuestion(questionTime);
      }

      // Show indicator 3 seconds before question
      if (currentTime >= questionTime - 3 && currentTime < questionTime) {
        setShowQuestionIndicator(true);
      } else {
        setShowQuestionIndicator(false);
      }

      // If it's time to show this question, trigger the modal and pause the video
      // Add a small buffer to prevent flashing
      const timeBuffer = 2.0; // Increased buffer to 2 seconds for better reliability
      
      // Round the question time to the nearest second for better reliability
      const roundedQuestionTime = Math.round(questionTime);
      
      console.log(`🎯 QUIZ: Time check - current: ${currentTime.toFixed(2)}s, question: ${questionTime}s, rounded: ${roundedQuestionTime}s, buffer: ${timeBuffer}s`);
      console.log(`🎯 QUIZ: Condition check - current >= rounded: ${currentTime >= roundedQuestionTime}, current <= rounded + buffer: ${currentTime <= roundedQuestionTime + timeBuffer}`);
      
      // Check if we should show this question
      // Case 1: We're at the exact timestamp (within buffer)
      // Case 2: We've passed the timestamp but haven't shown the question yet
      const shouldShowQuestion = (currentTime >= roundedQuestionTime && currentTime <= roundedQuestionTime + timeBuffer) ||
                                (currentTime > roundedQuestionTime && !shownQuestions.has(nextUnansweredQ.id));
      
      console.log(`🎯 QUIZ: Should show question: ${shouldShowQuestion} (at timestamp: ${currentTime >= roundedQuestionTime && currentTime <= roundedQuestionTime + timeBuffer}, passed but not shown: ${currentTime > roundedQuestionTime && !shownQuestions.has(nextUnansweredQ.id)})`);
      
      if (shouldShowQuestion) {
        console.log(`🎯 QUIZ: Triggering question ${nextUnansweredQ.id} at ${currentTime.toFixed(2)}s`);
        console.log(`🎯 QUIZ: Question: "${nextUnansweredQ.question.substring(0, 100)}..."`);
        
        const questionIndex = questions.findIndex(q => q.id === nextUnansweredQ.id);
        
        console.log(`🎯 QUIZ: Setting states - activeQuestion:`, nextUnansweredQ);
        console.log(`🎯 QUIZ: Setting states - currentQuestion: ${questionIndex >= 0 ? questionIndex : 0}`);
        console.log(`🎯 QUIZ: Setting states - showQuestion: true`);
        
        // Set states and immediately log to verify they're being set
        setActiveQuestion(nextUnansweredQ);
        setCurrentQuestion(questionIndex >= 0 ? questionIndex : 0);
        setShowQuestion(true);
        setShowQuestionIndicator(false);
        
        console.log(`🎯 QUIZ: States set - checking if they took effect...`);
        
        // Mark this question as shown to prevent it from being triggered again
        setShownQuestions(prev => new Set([...prev, nextUnansweredQ.id]));
        console.log(`🎯 QUIZ: Marked question ${nextUnansweredQ.id} as shown`);
        
        // Try to pause the video using the callback first, then fallback to direct player ref
        if (onPauseVideo) {
          console.log(`🎯 QUIZ: Pausing video using onPauseVideo callback`);
          onPauseVideo();
        } else if (playerRef.current && typeof playerRef.current.pause === 'function') {
          console.log(`🎯 QUIZ: Pausing video using direct player ref`);
          playerRef.current.pause();
        } else {
          console.warn(`🎯 QUIZ: Cannot pause video - no pause method available`);
        }
      }
    } else {
      // No more questions, so ensure no more pausing
      setNextQuestionTime(null);
      setShowQuestionIndicator(false);
      if (onNextQuestion) {
        onNextQuestion(null);
      }
    }
  }, [isActive, currentTime, loading, questions, showQuestion, selectedAnswers, onNextQuestion, lastCheckTime]);

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
    setShownQuestions(new Set()); // Reset shown questions when quiz is completed
    
    // Resume video playback
    if (onResumeVideo) {
      console.log("🎯 QUIZ: Resuming video playback");
      onResumeVideo();
    } else {
      console.warn("🎯 QUIZ: Cannot resume video - onResumeVideo function not provided");
    }
  };

  // Detect if a question is "Select ALL that apply" type
  const isMultipleChoiceQuestion = (question) => {
    // Check if the question text contains "all" or "multiple" or if there are multiple correct answers
    const questionText = question.question.toLowerCase();
    const hasMultipleKeywords = questionText.includes('all') || 
                               questionText.includes('multiple') || 
                               questionText.includes('select all') ||
                               questionText.includes('choose all');
    
    // Also check if the correct answer is an array (multiple correct answers)
    const hasMultipleCorrectAnswers = Array.isArray(question.correctAnswer);
    
    return hasMultipleKeywords || hasMultipleCorrectAnswers;
  };

  // Handle option selection
  const handleSelectAnswer = (questionId, optionId) => {
    console.log(`🎯 QUIZ: Selected answer ${optionId} for question ${questionId}`);
    
    const currentQuestion = questions.find(q => q.id === questionId) || activeQuestion;
    const isMultipleChoice = currentQuestion ? isMultipleChoiceQuestion(currentQuestion) : false;
    
    if (isMultipleChoice) {
      // For multiple choice questions, toggle the selection
      const currentSelections = selectedAnswers[questionId] || [];
      const newSelections = Array.isArray(currentSelections) ? [...currentSelections] : [];
      
      if (newSelections.includes(optionId)) {
        // Remove if already selected
        const index = newSelections.indexOf(optionId);
        newSelections.splice(index, 1);
      } else {
        // Add if not selected
        newSelections.push(optionId);
      }
      
      setSelectedAnswers({
        ...selectedAnswers,
        [questionId]: newSelections
      });
    } else {
      // For single choice questions, replace the selection
      setSelectedAnswers({
        ...selectedAnswers,
        [questionId]: optionId
      });
    }
  };

  // Handle submitting an answer
  const handleSubmitAnswer = () => {
    const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestion] : null);
    if (!currentQ) {
      console.error('🎯 QUIZ: No active question to submit');
      return;
    }
    
    const selectedOption = selectedAnswers[currentQ.id];
    if (!selectedOption || (Array.isArray(selectedOption) && selectedOption.length === 0)) {
      console.error('🎯 QUIZ: No answer selected');
      return;
    }
    
    // Check if answer is correct
    let isCorrect = false;
    const isMultipleChoice = isMultipleChoiceQuestion(currentQ);
    
    if (isMultipleChoice) {
      // For multiple choice questions, check if all correct answers are selected and no incorrect ones
      const correctAnswers = Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer : [currentQ.correctAnswer];
      const selectedAnswers = Array.isArray(selectedOption) ? selectedOption : [selectedOption];
      
      // All correct answers must be selected AND no incorrect answers should be selected
      const allCorrectSelected = correctAnswers.every(ans => selectedAnswers.includes(ans));
      const noIncorrectSelected = selectedAnswers.every(ans => correctAnswers.includes(ans));
      
      isCorrect = allCorrectSelected && noIncorrectSelected;
    } else {
      // For single choice questions, simple equality check
      isCorrect = selectedOption === currentQ.correctAnswer;
    }
    
    setAnswerCorrect(isCorrect);
    console.log(`🎯 QUIZ: Answer submitted: ${isCorrect ? 'Correct!' : 'Incorrect'} (${isMultipleChoice ? 'multiple choice' : 'single choice'})`);
    
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
        const isMultipleChoice = isMultipleChoiceQuestion(question);
        
        if (isMultipleChoice) {
          // For multiple choice questions, check if all correct answers are selected and no incorrect ones
          const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
          const selectedAnswers = Array.isArray(selected) ? selected : [selected];
          
          const allCorrectSelected = correctAnswers.every(ans => selectedAnswers.includes(ans));
          const noIncorrectSelected = selectedAnswers.every(ans => correctAnswers.includes(ans));
          
          return allCorrectSelected && noIncorrectSelected;
        } else {
          // For single choice questions, simple equality check
          return selected === question.correctAnswer;
        }
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
      
      // Simply hide the question and resume video from where it was paused
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
              <label>Content Coverage:</label>
              <div className={styles.configOptions}>
                {[
                  { value: 'low', label: 'Light', description: 'Fewer questions' },
                  { value: 'medium', label: 'Standard', description: 'Balanced coverage' },
                  { value: 'high', label: 'Comprehensive', description: 'More questions' }
                ].map((option) => (
                  <button 
                    key={option.value}
                    className={`${styles.configOption} ${quizConfig.contentDensity === option.value ? styles.selected : ''}`}
                    onClick={() => handleConfigChange('contentDensity', option.value)}
                    title={option.description}
                  >
                    <div className={styles.optionLabel}>{option.label}</div>
                    <div className={styles.optionDescription}>{option.description}</div>
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
  console.log(`🎯 QUIZ: Question display check - showQuestion: ${showQuestion}, activeQuestion:`, activeQuestion ? `ID ${activeQuestion.id}` : 'null');
  console.log(`🎯 QUIZ: Question display check - loading: ${loading}, showConfigPanel: ${showConfigPanel}`);
  
  if (showQuestion) {
    console.log(`🎯 QUIZ: 🎉 RENDERING QUESTION DISPLAY!`);
    console.log(`🎯 QUIZ: Rendering question display - showQuestion: ${showQuestion}, activeQuestion:`, activeQuestion);
    const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestion] : null);
    
    if (!currentQ) {
      console.error('🎯 QUIZ: No question to show');
      return null;
    }
    
    console.log(`🎯 QUIZ: About to render question:`, currentQ);
    
    // TEMPORARY DEBUG: Force show a test question if no active question
    if (!currentQ && questions.length > 0) {
      console.log(`🎯 QUIZ: DEBUG: Forcing test question display`);
      const testQ = questions[0];
      console.log(`🎯 QUIZ: DEBUG: Test question:`, testQ);
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
                  {isMultipleChoiceQuestion(currentQ) ? (
                    <div>
                      <p><strong>Your selections:</strong> {Array.isArray(selectedAnswers[currentQ.id]) ? selectedAnswers[currentQ.id].join(', ') : selectedAnswers[currentQ.id]}</p>
                      <p><strong>Correct answer(s):</strong> {Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer.join(', ') : currentQ.correctAnswer}</p>
                      {selectedOption?.explanation && <p>{selectedOption.explanation}</p>}
                    </div>
                  ) : (
                    selectedOption?.explanation
                  )}
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
                  {currentQ.options?.map(option => {
                    const isMultipleChoice = isMultipleChoiceQuestion(currentQ);
                    const currentSelections = selectedAnswers[currentQ.id] || [];
                    const isSelected = isMultipleChoice 
                      ? Array.isArray(currentSelections) && currentSelections.includes(option.id)
                      : selectedAnswers[currentQ.id] === option.id;
                    
                    return (
                      <div 
                        key={option.id}
                        className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                        onClick={() => handleSelectAnswer(currentQ.id, option.id)}
                      >
                        <span className={styles.optionLabel}>
                          {isMultipleChoice ? '☐' : '○'} {option.id.toUpperCase()}
                        </span>
                        <span className={styles.optionText}>{option.text}</span>
                      </div>
                    );
                  })}
                </div>
                
                <button 
                  className={styles.submitButton}
                  disabled={!selectedAnswers[currentQ.id] || (Array.isArray(selectedAnswers[currentQ.id]) && selectedAnswers[currentQ.id].length === 0)} 
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
    <>
      {/* Question indicator overlay */}
      {showQuestionIndicator && (
        <div className={styles.questionIndicator}>
          <div className={styles.indicatorContent}>
            <span className={styles.indicatorIcon}>⏰</span>
            <span>Question coming up in {Math.max(0, Math.ceil((nextQuestionTime - currentTime)))}s</span>
          </div>
        </div>
      )}
      
      <div className={styles.quizModeActive}>
        <div className={styles.quizInstructions}>
          <p>Quiz Mode Active. Questions will appear at key points in the video.</p>
          
          {/* TEMPORARY TEST: Manual question trigger button */}
          {questions.length > 0 && (
            <button 
              onClick={() => {
                console.log(`🎯 QUIZ: MANUAL TEST: Triggering question manually`);
                setActiveQuestion(questions[0]);
                setCurrentQuestion(0);
                setShowQuestion(true);
                setShownQuestions(prev => new Set([...prev, questions[0].id]));
                
                if (onPauseVideo) {
                  onPauseVideo();
                }
              }}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              TEST: Show First Question
            </button>
          )}
        </div>
      </div>
    </>
  );
}