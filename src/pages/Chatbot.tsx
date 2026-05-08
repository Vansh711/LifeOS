import { useState, useEffect, useRef } from 'react';
import { supabase, ChatMessage, HealthCondition } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { askGemini } from '../lib/gemini';
import { AlertCircle, Send, MessageCircle, Sparkles, Bot, User } from 'lucide-react';

const QUICK_PROMPTS = [
  "What foods should I avoid with diabetes?",
  "How much water should I drink daily?",
  "Best exercises for heart health?",
  "How to improve sleep quality?",
  "Foods that boost immunity?",
  "How to manage stress naturally?",
];

export default function Chatbot() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [msgsRes, conditionsRes] = await Promise.all([
        supabase.from('chat_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(50),
        supabase.from('health_conditions').select('*').eq('user_id', user.id),
      ]);
      setMessages(msgsRes.data ?? []);
      setConditions(conditionsRes.data ?? []);
      setInitialLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function buildSystemPrompt() {
    const conditionDetails = conditions.length > 0
      ? conditions.map(c => `${c.condition_name} (${c.severity}${c.medications ? `, medications: ${c.medications}` : ''}${c.notes ? `, notes: ${c.notes}` : ''})`).join('; ')
      : 'none reported';

    return `You are LifeOS AI, a knowledgeable and caring personal health assistant.
User profile: ${profile?.age ? `${profile.age} years old` : ''} ${profile?.gender || ''},
Activity level: ${profile?.activity_level || 'moderate'},
Diet: ${profile?.diet_types?.join(', ') || 'mixed'},
Health conditions: ${conditionDetails}.
Provide personalized, evidence-based health advice. If the user has health conditions, tailor the answer to those conditions and explain any risks, foods to limit, safer alternatives, and habits to monitor.
Always recommend consulting healthcare professionals for medical decisions.
Keep responses focused and under 300 words unless detailed explanation is needed.`;
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || !user || loading) return;
    setInput('');
    setLoading(true);
    setError('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(m => [...m, userMsg]);

    try {
      const { error: saveUserError } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, role: 'user', content: messageText });

      if (saveUserError) {
        console.warn('Could not save user chat message:', saveUserError);
      }

      const response = await askGemini(messageText, buildSystemPrompt());

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: response,
        created_at: new Date().toISOString(),
      };
      setMessages(m => [...m, assistantMsg]);
      const { error: saveAssistantError } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, role: 'assistant', content: response });

      if (saveAssistantError) {
        console.warn('Could not save assistant chat message:', saveAssistantError);
      }
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'AI is not responding right now.';
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: `AI is not responding right now: ${errorText}`,
        created_at: new Date().toISOString(),
      };
      setError(errorText);
      setMessages(m => [...m, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex-1 flex flex-col bg-[#060b14] h-screen">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-[#080f1e] flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-white font-semibold">LifeOS AI Assistant</h2>
          <p className="text-slate-500 text-xs">Powered by Gemini AI • Personalized to your health profile</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-xs">Online</span>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-white font-semibold text-lg">How can I help you today?</p>
              <p className="text-slate-500 text-sm mt-1">Ask me anything about your health, nutrition, or wellness</p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-cyan-500/30 rounded-xl text-slate-300 text-sm transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10'
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-white" />
                    : <Bot className="w-4 h-4 text-slate-300" />
                  }
                </div>
                <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-tr-sm'
                      : 'bg-[#0d1f3c]/80 border border-white/5 text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                    ))}
                  </div>
                  <span className="text-slate-600 text-xs px-1">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-slate-300" />
                </div>
                <div className="bg-[#0d1f3c]/80 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-[#080f1e]">
        {messages.length > 0 && !loading && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {QUICK_PROMPTS.slice(0, 3).map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                className="flex-shrink-0 text-xs px-3 py-1.5 bg-white/5 border border-white/10 hover:border-cyan-500/30 text-slate-400 hover:text-slate-300 rounded-lg transition-all">
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about your health, nutrition, or wellness..."
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
