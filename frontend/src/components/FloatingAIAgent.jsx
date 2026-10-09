import { useState, useEffect } from 'react';

export default function FloatingAIAgent({ currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue('');

    // Simulate AI response based on keywords
    setTimeout(() => {
      let aiResponse = "I'm here to help! Could you provide more details?";
      const lowerMsg = userMsg.toLowerCase();
      
      if (lowerMsg.includes('how') && (lowerMsg.includes('ai') || lowerMsg.includes('work'))) {
        aiResponse = "The AI uses computer vision to detect defects in uploaded images, and machine learning on hydraulic data to predict failures.";
      } else if (lowerMsg.includes('damage') || lowerMsg.includes('detect')) {
        aiResponse = "To use Damage Detection, go to the Mobile Inspect page and upload a photo of the equipment. Our AI will automatically detect defects.";
      } else if (lowerMsg.includes('predict') || lowerMsg.includes('maintain') || lowerMsg.includes('sensor')) {
        aiResponse = "The Predictive Maintenance section shows live hydraulic sensor data. The AI analyzes this to estimate when maintenance will be needed.";
      } else if (lowerMsg.includes('dashboard')) {
        aiResponse = "The Dashboard gives you an overview of the entire system, showing the status of 3D components and any active alerts.";
      } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        aiResponse = "Hello! How can I assist you with Industria today?";
      }

      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
    }, 600);
  };

  useEffect(() => {
    // Determine context based on current page
    let contextMessage = '';
    switch (currentPage) {
      case 'dashboard':
        contextMessage = "Welcome to the Digital Twin Dashboard. Here you can see a high-level overview of factory health, 3D component status, and real-time alerts.";
        break;
      case 'mobile':
        contextMessage = "You're in Mobile Inspect. Upload photos of equipment from the factory floor to run instant AI damage detection and thermal analysis.";
        break;
      case 'damage':
        contextMessage = "This is the Damage Detection center. It shows AI-annotated bounding boxes of defects like rust, tears, and leaks across all scanned components.";
        break;
      case 'predictive':
        contextMessage = "Predictive Maintenance gives you a look into the future. It analyzes hydraulic sensor data (pressure, temp, vibration) to forecast potential failures before they happen.";
        break;
      default:
        contextMessage = "Hello! I'm your Industria AI Assistant. I can help guide you through the software and provide insights on your factory's health.";
    }

    setMessages([
      { sender: 'ai', text: "Hello! I'm your Industria AI Assistant." },
      { sender: 'ai', text: contextMessage }
    ]);
  }, [currentPage]);

  return (
    <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999 }}>
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '70px', right: '0',
          width: '320px', background: '#ffffff',
          borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0', overflow: 'hidden',
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', boxShadow: '0 0 15px rgba(220,38,38,0.5)'
              }}>
                <img src="/spiderman.png" alt="Agent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Industria AI</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Online</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{
              background: 'transparent', border: 'none', color: '#94a3b8',
              cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center'
            }}>×</button>
          </div>
          
          <div style={{ padding: '20px', maxHeight: '300px', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.sender === 'ai' ? 'flex-start' : 'flex-end',
                background: msg.sender === 'ai' ? '#ffffff' : '#3b82f6',
                color: msg.sender === 'ai' ? '#334155' : '#ffffff',
                padding: '10px 14px', borderRadius: '12px',
                border: msg.sender === 'ai' ? '1px solid #e2e8f0' : 'none',
                borderBottomLeftRadius: msg.sender === 'ai' ? '4px' : '12px',
                borderBottomRightRadius: msg.sender === 'ai' ? '12px' : '4px',
                fontSize: '13px', lineHeight: '1.5', maxWidth: '85%',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}>
                {msg.text}
              </div>
            ))}
          </div>
          
          <form onSubmit={handleSendMessage} style={{ padding: '12px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Ask for guidance..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1, padding: '10px', borderRadius: '20px',
                border: '1px solid #e2e8f0', background: '#f1f5f9',
                outline: 'none', fontSize: '13px', color: '#334155'
              }}
            />
            <button type="submit" style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: '50%', width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.4)'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 8px 24px rgba(220,38,38,0.4)',
          transition: 'transform 0.2s', transform: isOpen ? 'scale(0.9)' : 'scale(1)',
          position: 'relative', padding: 0
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = isOpen ? 'scale(0.9)' : 'scale(1)'}
      >
        <img src="/spiderman.png" alt="AI Agent" style={{ width: '100%', height: '100%', objectFit: 'contain', animation: 'float 3s ease-in-out infinite', borderRadius: '50%' }} />
        {!isOpen && (
          <span style={{
            position: 'absolute', top: '0px', right: '0px',
            width: '16px', height: '16px', background: '#3b82f6',
            borderRadius: '50%', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 'bold', color: '#fff'
          }}>1</span>
        )}
      </button>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
      `}</style>
    </div>
  );
}
