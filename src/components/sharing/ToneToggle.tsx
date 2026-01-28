"use client";

interface ToneToggleProps {
  value: 'dm' | 'group';
  onChange: (value: 'dm' | 'group') => void;
}

export const ToneToggle: React.FC<ToneToggleProps> = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">Sharing to:</label>
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onChange('dm')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            value === 'dm'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          One person
        </button>
        <button
          type="button"
          onClick={() => onChange('group')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            value === 'group'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          A group
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {value === 'dm' 
          ? 'More personal, direct messaging style'
          : 'Group-friendly with confirmation options'
        }
      </div>
    </div>
  );
};
