import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../styles/VideoChat.module.css';

export default function VideoChat({ videoId, videoTitle, summary, transcript, currentTime }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Generate unique chat session ID
  useEffect(() => {
    if (!chatSessionId) {
      setChatSessionId(`chat_${videoId}_${Date.now()}`);
    }
  }, [videoId, chatSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message function
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/youtube/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          videoTitle,
          summary,
          transcript,
          currentTime,
          question: userMessage.content,
          chatSessionId,
          messageHistory: messages
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      sendMessage(e);
    }
  };

  // Welcome message on first load
  useEffect(() => {
    if (messages.length === 0 && summary) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Hello! I'm your AI tutor for **"${videoTitle}"**. I've analyzed this video and I'm here to help you understand the content.

Here are some questions you might want to ask:
• What are the main topics covered in this video?
• Can you explain the key concepts mentioned?
• What should I focus on while watching?
• Are there any important details I shouldn't miss?

Feel free to ask me anything about what you're learning!`,
        timestamp: new Date().toISOString(),
        isWelcome: true,
      };
      setMessages([welcomeMessage]);
    }
  }, [summary, videoTitle, messages.length]);

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h3>💬 AI Learning Assistant</h3>
        <span className={styles.videoTitle}>{videoTitle}</span>
      </div>
      
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.type]} ${message.isError ? styles.error : ''} ${message.isWelcome ? styles.welcome : ''}`}
          >
            <div className={styles.messageContent}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom styling for markdown elements
                  h1: ({node, ...props}) => <h1 style={{fontSize: '1.2em', margin: '0.5em 0', fontWeight: 'bold'}} {...props} />,
                  h2: ({node, ...props}) => <h2 style={{fontSize: '1.1em', margin: '0.4em 0', fontWeight: 'bold'}} {...props} />,
                  h3: ({node, ...props}) => <h3 style={{fontSize: '1em', margin: '0.3em 0', fontWeight: 'bold'}} {...props} />,
                  p: ({node, ...props}) => <p style={{margin: '0.3em 0'}} {...props} />,
                  ul: ({node, ...props}) => <ul style={{margin: '0.3em 0', paddingLeft: '1.5em'}} {...props} />,
                  ol: ({node, ...props}) => <ol style={{margin: '0.3em 0', paddingLeft: '1.5em'}} {...props} />,
                  li: ({node, ...props}) => <li style={{margin: '0.2em 0'}} {...props} />,
                  strong: ({node, ...props}) => <strong style={{fontWeight: 'bold'}} {...props} />,
                  em: ({node, ...props}) => <em style={{fontStyle: 'italic'}} {...props} />,
                  code: ({node, ...props}) => <code style={{backgroundColor: '#f0f0f0', padding: '0.2em 0.4em', borderRadius: '3px', fontFamily: 'monospace'}} {...props} />,
                  blockquote: ({node, ...props}) => <blockquote style={{borderLeft: '3px solid #ccc', margin: '0.5em 0', paddingLeft: '1em', fontStyle: 'italic'}} {...props} />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            <div className={styles.messageTimestamp}>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className={`${styles.message} ${styles.ai}`}>
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about this video..."
            className={styles.chatInput}
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
      </form>
    </div>
  );
}
