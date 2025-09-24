import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getQuestionById, type Question } from '../../data/questions';
import { EvaluationHistoryService } from '../../services/evaluationHistoryService';
import { TokenEstimator } from '../../services/tokenEstimator';
import { RatingModeSelector } from './RatingModeSelector';
import { AnswerInput } from './AnswerInput';
import {
  ArrowLeft,
  Code,
  User,
  Lightbulb,
  AlertCircle,
  Zap,
  Loader,
  Brain,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AIEvaluationService } from '../../services/ai/aiEvaluationService';

// Add this at the top of your file or in a .d.ts file
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Add proper types for speech recognition
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onnomatch: (() => void) | null;
}


export const PracticeSession: React.FC = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [ratingMode, setRatingMode] = useState<'tough' | 'lenient'>('lenient');
  
  const [canStartPractice] = useState(true);
  
  // Evaluation type
  const [evaluationType, setEvaluationType] = useState<'simple' | 'detailed'>('simple');
  
  // Add a submission lock to prevent double submissions
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);
  
  // Track if recognition is initialized to prevent duplicate initialization
  const recognitionInitialized = useRef(false);
  // Track the last transcript to avoid duplicates
  const lastTranscript = useRef('');

  // Debug logging function
  const addDebugLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`🔧 ${logMessage}`);
    setDebugInfo(prev => [...prev.slice(-4), logMessage]); // Keep last 5 logs
    
    if (type === 'error') {
      toast.error(message);
    } else if (type === 'success') {
      toast.success(message);
    } else if (type === 'warning') {
      toast(message, { icon: '⚠️' });
    }
  };

  useEffect(() => {
    if (questionId) {
      fetchQuestion();
    }
    if (!recognitionInitialized.current) {
      initializeSpeechRecognition();
      recognitionInitialized.current = true;
    }
    checkApiKeys();
    
    // Cleanup function to stop recording if component unmounts
    return () => {
      if (isRecording && recognition) {
        recognition.stop();
      }
    };
  }, [questionId]);


  const checkApiKeys = () => {
    // Check if Gemini API key is available
    const hasGeminiKey = !!localStorage.getItem('gemini_api_key');
    console.log('🔑 Gemini API key available:', hasGeminiKey);
  };

  const fetchQuestion = async () => {
    try {
      addDebugLog(`Fetching question with ID: ${questionId}`);
      const foundQuestion = getQuestionById(questionId!);
      if (!foundQuestion) {
        addDebugLog(`Question not found: ${questionId}`, 'error');
        navigate('/dashboard');
        return;
      }
      addDebugLog(`Question found: ${foundQuestion.title}`, 'success');
      setQuestion(foundQuestion);
    } catch (error) {
      addDebugLog(`Error fetching question: ${error}`, 'error');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const initializeSpeechRecognition = () => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      addDebugLog('Speech recognition not supported in this browser', 'error');
      return;
    }
    
    const recognition = new SpeechRecognitionClass();
    
    // Configure recognition settings
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    // Add timeout to prevent hanging
    let recognitionTimeout: NodeJS.Timeout;

    recognition.onstart = () => {
      addDebugLog('Speech recognition started', 'success');
      // Set a timeout to restart if no results after 10 seconds
      recognitionTimeout = setTimeout(() => {
        if (isRecording) {
          addDebugLog('Speech recognition timeout, restarting...', 'info');
          recognition.stop();
        }
      }, 10000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Clear timeout when we get results
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      
      if (transcript && transcript !== lastTranscript.current) {
        lastTranscript.current = transcript;
        setAnswer(prev => prev + ' ' + transcript);
        addDebugLog(`Transcript: ${transcript}`, 'success');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Clear timeout on error
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      
      let errorMessage = `Speech recognition error: ${event.error}`;
      let errorType: 'error' | 'warning' = 'error';
      
      // Handle specific error types
      switch (event.error) {
        case 'network':
          errorMessage = 'Network error: Please check your internet connection and try again. This can happen due to firewall or proxy settings.';
          errorType = 'error';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone permissions and refresh the page.';
          errorType = 'error';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please speak clearly and try again.';
          errorType = 'warning';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture error. Please check your microphone and try again.';
          errorType = 'error';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed. Please check your browser settings.';
          errorType = 'error';
          break;
        case 'bad-grammar':
          errorMessage = 'Grammar error in speech recognition.';
          errorType = 'warning';
          break;
        case 'language-not-supported':
          errorMessage = 'Language not supported. Please try with English.';
          errorType = 'error';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
          errorType = 'error';
      }
      
      addDebugLog(errorMessage, errorType);
      setIsRecording(false);
      
      // For network errors, try to restart after a delay
      if (event.error === 'network' && isRecording) {
        setTimeout(() => {
          if (isRecording) {
            addDebugLog('Attempting to restart speech recognition after network error...', 'info');
            try {
              recognition.start();
            } catch (e) {
              addDebugLog('Failed to restart speech recognition', 'error');
            }
          }
        }, 2000);
      }
    };

    recognition.onend = () => {
      // Clear timeout
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
      }
      
      if (isRecording) {
        // Add a small delay before restarting to prevent rapid restarts
        setTimeout(() => {
          if (isRecording) {
            try {
              recognition.start();
              addDebugLog('Restarting speech recognition', 'info');
            } catch (e) {
              addDebugLog('Failed to restart speech recognition', 'error');
              setIsRecording(false);
            }
          }
        }, 100);
      } else {
        setIsRecording(false);
      }
    };

    recognition.onaudiostart = () => {
      addDebugLog('Audio capture started', 'info');
    };

    recognition.onaudioend = () => {
      addDebugLog('Audio capture ended', 'info');
    };

    recognition.onspeechstart = () => {
      addDebugLog('Speech detected', 'info');
    };

    recognition.onspeechend = () => {
      addDebugLog('Speech ended', 'info');
    };

    recognition.onnomatch = () => {
      addDebugLog('No speech match found', 'warning');
    };

    setRecognition(recognition);
    addDebugLog('Speech recognition initialized successfully', 'success');
  };

  const toggleRecording = () => {
    if (!recognition) {
      addDebugLog('Speech recognition not supported in this browser', 'error');
      return;
    }

    if (isRecording) {
      try {
        recognition.stop();
        setIsRecording(false);
        addDebugLog('Recording stopped');
      } catch (e) {
        addDebugLog('Error stopping recording', 'error');
        setIsRecording(false);
      }
    } else {
      // Reset last transcript when starting new recording
      lastTranscript.current = '';
      try {
        recognition.start();
        setIsRecording(true);
        addDebugLog('Recording started');
      } catch (e) {
        addDebugLog('Error starting recording. Please check microphone permissions.', 'error');
        setIsRecording(false);
      }
    }
  };


  const submitAnswer = async (evalType: 'simple' | 'detailed' = evaluationType) => {
    // Validation
    if (!answer.trim()) {
      addDebugLog('Please provide an answer', 'error');
      return;
    }

    if (!user || !question) {
      addDebugLog('Missing user or question data', 'error');
      return;
    }


    // Prevent double submissions
    if (submitting || isSubmissionLocked) {
      addDebugLog('Submission already in progress', 'info');
      return;
    }

    // Check token limits for Gemini
    const tokenCheck = TokenEstimator.canEvaluate(question.description, answer, 'gemini');
    if (!tokenCheck.canEvaluate) {
      addDebugLog(tokenCheck.message, 'error');
      return;
    }
    addDebugLog(tokenCheck.message);

    // Start submission process
    setSubmitting(true);
    setIsSubmissionLocked(true); // Lock to prevent double submissions
    addDebugLog(`🚀 Starting submission with ${ratingMode} rating mode, Gemini provider, and ${evalType} evaluation...`);

    try {
      // Stop recording if active
      if (isRecording && recognition) {
        recognition.stop();
        setIsRecording(false);
      }
      
      // Calculate response time
      const responseTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      addDebugLog(`Response time: ${responseTimeSeconds} seconds`);

      // Force the selected provider if not auto
      // Force Gemini provider
      AIEvaluationService.forceProvider('gemini');
      addDebugLog('Using Gemini provider');

      // Create response object (stored locally)
      const responseData = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        question_id: question.id,
        answer_text: answer.trim(),
        image_urls: [], // No images in face monitoring mode
        response_time_seconds: responseTimeSeconds,
        rating_mode: ratingMode,
        selected_provider: 'gemini',
        evaluation_type: evalType,
        proctoring_enabled: false,
        proctoring_type: 'none',
        violations: [],
        presence_report: null,
        created_at: new Date().toISOString(),
      };

      addDebugLog('Prepared response data');
      addDebugLog(`User ID: ${user.id}`);
      addDebugLog(`Question ID: ${question.id}`);
      addDebugLog(`Answer length: ${answer.trim().length} characters`);
      addDebugLog(`Rating mode: ${ratingMode}`);
      addDebugLog('Provider: Gemini');
      addDebugLog(`Evaluation type: ${evalType}`);

      // Store locally and navigate to evaluation
      addDebugLog('Storing response locally...');
      
      // Store in localStorage for the evaluation page
      localStorage.setItem('current_response', JSON.stringify(responseData));
      localStorage.setItem('current_question', JSON.stringify(question));

      addDebugLog(`Response stored locally with ID: ${responseData.id}`, 'success');

      // Try to save to database if user is logged in
      if (user) {
        try {
          await EvaluationHistoryService.saveEvaluation(
            user.id,
            question.id,
            question.title,
            question.category,
            answer.trim(),
            {
              clarity_score: 7, // Placeholder scores until real evaluation
              relevance_score: 7,
              critical_thinking_score: 7,
              thoroughness_score: 7,
              overall_score: 7,
              feedback_text: "Saving initial evaluation...",
              strengths: ["Initial save"],
              improvements: ["Will be updated with real evaluation"],
              rating_mode: ratingMode,
              evaluation_type: evalType
            },
            responseTimeSeconds
          );
          addDebugLog('Initial evaluation saved to database', 'success');
        } catch (dbError) {
          addDebugLog(`Database save failed: ${dbError}`, 'error');
          // Continue even if database save fails
        }
      }

      // Navigate to evaluation
      addDebugLog('Navigating to evaluation page...');
      navigate(`/evaluation/${responseData.id}`);
      
    } catch (error: any) {
      addDebugLog(`Submission failed: ${error.message}`, 'error');
      setIsSubmissionLocked(false); // Unlock if there's an error
    } finally {
      setSubmitting(false);
      // Keep the lock active to prevent double submissions
      // The lock will be reset when the user navigates away or the component unmounts
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4 transition-colors duration-200">Loading question...</p>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 transition-colors duration-200">Question not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'hard':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'behavioral':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'technical':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700';
      case 'situational':
        return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'behavioral':
        return User;
      case 'technical':
        return Code;
      case 'situational':
        return Lightbulb;
      default:
        return User;
    }
  };

  const CategoryIcon = getCategoryIcon(question.category);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className={`p-2 rounded-lg ${getCategoryColor(question.category).replace('text-', 'text-').replace('bg-', 'bg-')} transition-colors duration-200`}>
                <CategoryIcon className="h-5 w-5" />
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getCategoryColor(question.category)} transition-colors duration-200`}>
                  {question.category}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(question.difficulty)} transition-colors duration-200`}>
                  {question.difficulty}
                </span>
              </div>
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3 transition-colors duration-200">
              {question.title}
            </h1>

            <p className="text-gray-700 dark:text-gray-300 leading-relaxed transition-colors duration-200">
              {question.description}
            </p>

            {question.tags && question.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {question.tags.slice(0, 5).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md transition-colors duration-200"
                  >
                    {tag}
                  </span>
                ))}
                {question.tags.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-md transition-colors duration-200">
                    +{question.tags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Options - Compact Layout */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          {/* Evaluation Type Selection - Simplified */}
          <div className="bg-white dark:bg-[#003135] rounded-xl shadow-sm p-4 border border-[#AFDDE5] dark:border-[#024950] transition-colors duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <Brain className="h-5 w-5 text-[#0FA4AF]" />
              <h2 className="text-base font-semibold text-[#003135] dark:text-[#AFDDE5] transition-colors duration-200">Evaluation Type</h2>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setEvaluationType('simple')}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  evaluationType === 'simple'
                    ? 'border-[#0FA4AF] bg-[#AFDDE5]/20 dark:bg-[#024950] text-[#003135] dark:text-[#AFDDE5]'
                    : 'border-[#AFDDE5] dark:border-[#024950] hover:border-[#0FA4AF] text-[#003135] dark:text-[#AFDDE5]'
                } transition-colors duration-200`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${evaluationType === 'simple' ? 'bg-[#0FA4AF]' : 'bg-[#AFDDE5] dark:bg-[#024950]'} transition-colors duration-200`}>
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-medium">Simple</h3>
                    <p className="text-xs opacity-75">Faster feedback</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setEvaluationType('detailed')}
                className={`flex-1 p-3 rounded-lg border transition-all ${
                  evaluationType === 'detailed'
                    ? 'border-[#964734] bg-[#964734]/10 dark:bg-[#024950] text-[#964734] dark:text-[#AFDDE5]'
                    : 'border-[#AFDDE5] dark:border-[#024950] hover:border-[#964734] text-[#003135] dark:text-[#AFDDE5]'
                } transition-colors duration-200`}
              >
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${evaluationType === 'detailed' ? 'bg-[#964734]' : 'bg-[#AFDDE5] dark:bg-[#024950]'} transition-colors duration-200`}>
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-medium">Detailed</h3>
                    <p className="text-xs opacity-75">In-depth analysis</p>
                  </div>
                </div>
              </button>
            </div>

            {evaluationType === 'detailed' && (
              <div className="mt-3 p-2 bg-[#964734]/10 dark:bg-[#024950] border border-[#964734] dark:border-[#024950] rounded-lg text-xs transition-colors duration-200">
                <div className="flex items-start space-x-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#964734] mt-0.5 flex-shrink-0" />
                  <p className="text-[#964734] dark:text-[#AFDDE5] transition-colors duration-200">
                    Uses 2-3x more tokens than simple evaluation. May impact API limits.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Configuration Options Row 2 - Compact Layout */}
        {canStartPractice && (
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* Rating Mode Selection */}
            <RatingModeSelector
              ratingMode={ratingMode}
              onRatingModeChange={setRatingMode}
            />
          </div>
        )}

        {/* Enhanced Mode Notice */}
        {canStartPractice && (
          <div className="bg-[#0FA4AF]/10 dark:bg-[#024950] border border-[#0FA4AF] dark:border-[#024950] rounded-xl p-3 mb-6 transition-colors duration-200">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-[#0FA4AF]" />
              <p className="text-sm text-[#003135] dark:text-[#AFDDE5] transition-colors duration-200">
                <span className="font-medium">⚡ Ready for AI Evaluation:</span> {evaluationType === 'detailed' ? 'Comprehensive' : 'Standard'} evaluation with Gemini AI
              </p>
            </div>
          </div>
        )}

        {/* Answer Input Section */}
        {canStartPractice && (
          <div className="mb-6">
            <AnswerInput
              answer={answer}
              onAnswerChange={setAnswer}
              isRecording={isRecording}
              onToggleRecording={toggleRecording}
              startTime={startTime}
              debugInfo={debugInfo}
            />
          </div>
        )}

        {/* Submit Button */}
        {canStartPractice && (
          <div className="flex justify-end">
            <button
              onClick={() => !isSubmissionLocked && submitAnswer(evaluationType)}
              disabled={submitting || !answer.trim() || isSubmissionLocked}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {submitting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  <span>Submit for AI Evaluation</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};