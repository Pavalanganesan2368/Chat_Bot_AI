import { useState, useRef, useEffect } from 'react'
import './index.css'

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! How can I assist you today?', timestamp: '10:00 AM' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { 
      role: 'user', 
      content: input, 
      timestamp: getCurrentTime() 
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3', 
          messages: [{ role: 'user', content: userMessage.content }],
          stream: true
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch response')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let botMessageContent = ''
      
      // Add placeholder for bot message
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: getCurrentTime() }])

      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        const lines = buffer.split('\n')
        // Keep the last part in buffer if it may be incomplete
        // If the chunk ends with newline, the last element is empty string, which is fine to keep as buffer (it will just be empty)
        // But if it doesn't end with newline, the last element is the incomplete line
        buffer = lines.pop() || '' 
        
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.message && json.message.content) {
              botMessageContent += json.message.content
              
              setMessages(prev => {
                const newMessages = [...prev]
                const lastIndex = newMessages.length - 1
                if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
                  // Create a new object for the last message to ensure immutability
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    content: botMessageContent
                  }
                }
                return newMessages
              })
            }
          } catch (e) {
            console.error("Error parsing JSON chunk", e)
          }
        }
      }

    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: getCurrentTime() }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] font-sans">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between shadow-sm border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            🤖
          </div>
          <h1 className="font-semibold text-gray-800 text-lg">ChatBot</h1>
        </div>
        <div className="flex gap-2">
          <button className="text-gray-400 hover:text-gray-600 p-1">─</button>
          <button className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
                  ${msg.role === 'user' 
                    ? 'bg-[#c94429] text-white rounded-br-none' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}
              >
                {msg.content}
              </div>
              <span className="text-xs text-gray-400 mt-1 px-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-200">
        {/* Chips */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
          {['Billing', 'Support', 'Features', 'Pricing'].map((chip) => (
            <button 
              key={chip}
              onClick={() => setInput(chip + " ")}
              className="px-4 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Field */}
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            📎
          </button>
          <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            😊
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#c94429]/20 focus:border-[#c94429] transition-all shadow-sm text-gray-700"
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="absolute right-1 top-1 bottom-1 aspect-square bg-[#c94429] hover:bg-[#b03a23] text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ➤
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
