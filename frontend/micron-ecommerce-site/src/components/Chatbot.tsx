import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { sendChatMessage, getProductById } from '../api/endpoints';
import type { RankedProduct, ChatHistoryTurn } from '../types/api-types';
import { useApp } from '../context/AppContext';

interface UIMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  products?: RankedProduct[];
}

/** Helper component to fetch and render the real image URL for RankedProduct */
const ChatProductCard: React.FC<{ prod: RankedProduct }> = ({ prod }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch full product details to get its real imageUrl
    getProductById(prod.id)
      .then((fullProduct) => {
        if (fullProduct.imageUrl) {
          setImageUrl(fullProduct.imageUrl);
        }
      })
      .catch(() => {
        // Silently ignore failures and display category icon fallback
      });
  }, [prod.id]);

  return (
    <Link
      to={`/product/${prod.id}`}
      className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-600 transition shadow-sm"
    >
      <div className="w-10 h-10 bg-slate-100 rounded shrink-0 flex items-center justify-center text-slate-400 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={prod.name}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          /* SVG Fallback Icon when image is loading or unavailable */
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-slate-800 text-xs">{prod.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-indigo-600 font-bold text-xs">₹{prod.price}</span>
          {prod.discountPercent > 0 && (
            <span className="text-slate-400 line-through text-[10px]">₹{prod.listPrice}</span>
          )}
        </div>
      </div>
    </Link>
  );
};

export const Chatbot: React.FC = () => {
  const { cart } = useApp();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<UIMessage[]>([
    { id: '1', sender: 'bot', text: 'Hi! Looking for recommendations or help with your order?' },
  ]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMsg: UIMessage = { id: Date.now().toString(), sender: 'user', text: userText };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history: ChatHistoryTurn[] = messages
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }))
        .slice(-10);

      const response = await sendChatMessage({
        message: userText,
        history,
        cart,
        sessionId,
      });

      setSessionId(response.sessionId);

      const botMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.reply,
        products: response.products,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: error instanceof Error ? error.message : "Sorry, I'm having trouble connecting right now.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {isOpen && (
        <div className="w-96 h-112 bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col mb-3 overflow-hidden transition-all">
          <div className="bg-slate-900 px-4 py-3 flex justify-between items-center text-white">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-xs font-semibold">AURA AI Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs bg-slate-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                }`}>
                  {msg.text}
                </div>

                {msg.products && msg.products.length > 0 && (
                  <div className="mt-2 w-full space-y-1.5">
                    {msg.products.map((prod) => (
                      <ChatProductCard key={prod.id} prod={prod} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="text-slate-400 text-[10px] animate-pulse">Assistant is thinking...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-600 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

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