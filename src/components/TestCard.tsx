import React from 'react';

export const TestCard: React.FC = () => {
  // Using useEffect to update time on client-side only to prevent hydration mismatch
  const [currentTime, setCurrentTime] = React.useState('');

  React.useEffect(() => {
    // This only runs on the client, after hydration
    setCurrentTime(new Date().toLocaleTimeString());
    
    // Optional: Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-purple-600 p-4 rounded-lg shadow-lg border-4 border-yellow-400 max-w-sm">
      <h3 className="text-white text-xl font-bold">TEST CARD - THIS IS NEW!</h3>
      <p className="text-white">This is a test component to verify component rendering.</p>
      <div className="mt-2 p-2 bg-yellow-400 text-black rounded">
        Current time: {currentTime}
      </div>
    </div>
  );
};
