import React, { useState, useRef, useEffect } from 'react';
import { type SubmitEvent } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

export const Chatbot: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hi! Looking for recommendations or help with your order?' },
  ]);
  const [input, setInput] = useState<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: userText };
    const loadingId = Date.now().toString() + 'loading';
    setMessages((prev) => [...prev, userMsg, { id: loadingId, sender: 'bot', text: 'Thinking...' }]);
    setInput('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      const data = await response.json();
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply,
      };
      setMessages((prev) => prev.map(m => m.id === loadingId ? botMsg : m));
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: "Sorry, I'm having trouble connecting right now.",
      };
      setMessages((prev) => prev.map(m => m.id === loadingId ? errorMsg : m));
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {/* Floating Chat Window */}
      {isOpen && (
        <div className="w-80 h-96 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col mb-3 overflow-hidden transition-all">
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3 flex justify-between items-center text-white">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-xs font-semibold">AURA AI Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {/* Message List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {/* Scroll Target */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-600"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-12 w-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition"
        aria-label="Toggle Chatbot"
      >
        💬
      </button>
    </div>
  );
};