'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
}

interface Chat {
  id: string;
  title: string;
}

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChat();
    fetchMessages();
  }, [resolvedParams.chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/chats/${resolvedParams.chatId}`);
      if (!res.ok) {
        router.push('/chats');
        return;
      }
      const data = await res.json();
      setChat(data.chat);
    } catch (error) {
      console.error('Failed to fetch chat:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${resolvedParams.chatId}`);
      if (!res.ok) {
        router.push('/chats');
        return;
      }
      const data = await res.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!inputValue.trim() && !selectedImage) || sending) return;

    const userMessage = inputValue.trim();
    const userImage = selectedImage;
    setInputValue('');
    setSelectedImage(null);
    setSending(true); // MODIFY: Set loading state immediately

    const tempUserMessage: Message = {
      id: 'temp-user',
      role: 'user',
      content: userMessage,
      imageUrl: userImage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // ADD: Optimistic AI message placeholder
    const tempAiMessage: Message = {
      id: 'temp-ai',
      role: 'assistant',
      content: 'Generating reply...',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempAiMessage]);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: resolvedParams.chatId,
          userMessage: userMessage || '[Image uploaded]',
          imageUrl: userImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ADD: Show specific error message from backend
        const errorMsg = data.error || 'Failed to generate reply';
        throw new Error(errorMsg);
      }
      
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== 'temp-user' && m.id !== 'temp-ai');
        return [...withoutTemp, 
          { ...tempUserMessage, id: `user-${Date.now()}` },
          data.message
        ];
      });
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // ADD: Remove loading message
      setMessages((prev) => prev.filter((m) => m.id !== 'temp-ai'));
      
      // ADD: Show user-friendly error
      const errorMessage = error.message || 'Failed to generate reply. Please try again.';
      alert(errorMessage);
      
      // ADD: Restore user message if it was removed
      setMessages((prev) => {
        const hasUserMsg = prev.some(m => m.id === 'temp-user');
        if (!hasUserMsg) {
          return [...prev, { ...tempUserMessage, id: `user-${Date.now()}` }];
        }
        return prev;
      });
    } finally {
      setSending(false); // MODIFY: Always clear loading state
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteChat = async () => {
    if (!confirm('Delete this chat? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/chats/${resolvedParams.chatId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/chats');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link 
              href="/chats" 
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {chat?.title}
            </h1>
          </div>
          <button
            onClick={deleteChat}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
          >
            Delete
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : message.id === 'temp-ai' 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 italic' // ADD: Loading state styling
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {message.imageUrl && (
                    <img 
                      src={message.imageUrl} 
                      alt="Uploaded" 
                      className="max-w-full rounded-lg mb-2 max-h-64 object-contain"
                    />
                  )}
                  {message.content && (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <img 
                src={selectedImage} 
                alt="Selected" 
                className="max-h-32 rounded-lg"
              />
              <button
                onClick={removeImage}
                disabled={sending} // ADD: Disable during loading
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending} // MODIFY: Disable during loading
              className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-xl"
            >
              📷
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={sending ? "Generating reply..." : "Type your message..."} // ADD: Dynamic placeholder
              disabled={sending} // MODIFY: Disable during loading
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={sending || (!inputValue.trim() && !selectedImage)} // MODIFY: Disable during loading
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {sending ? 'Sending...' : 'Send'} {/* ADD: Dynamic button text */}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}