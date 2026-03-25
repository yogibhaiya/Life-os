import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeech(onFinalTranscript?: (text: string, isContinuous: boolean) => void, language: string = 'bn-IN') {
  const [isListening, setIsListening] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const isContinuousRef = useRef(false);

  useEffect(() => {
    let rec: any = null;
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = language; 

        rec.onresult = (event: any) => {
          let current = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              current += event.results[i][0].transcript;
            }
          }
          
          if (final) {
            if (onFinalTranscript) {
              onFinalTranscript(final.trim(), isContinuousRef.current);
            }
            setTranscript(''); // Clear transcript after processing
          } else {
            setTranscript(current);
          }
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') {
            isContinuousRef.current = false;
            setIsContinuous(false);
            setIsListening(false);
          }
        };

        rec.onend = () => {
          if (isContinuousRef.current) {
            try {
              rec.start();
            } catch (e) {
              console.error('Failed to restart continuous listening', e);
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = rec;
      }
    }
    
    return () => {
      if (rec) {
        rec.stop();
      }
    };
  }, [onFinalTranscript, language]);

  const startListening = useCallback((continuousMode = false) => {
    if (recognitionRef.current) {
      isContinuousRef.current = continuousMode;
      setIsContinuous(continuousMode);
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      isContinuousRef.current = false;
      setIsContinuous(false);
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return { isListening, isContinuous, transcript, startListening, stopListening, setTranscript };
}
