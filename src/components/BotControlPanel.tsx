import React from 'react';
import { useAppStore } from '../store/appStore';
import { IconPlayerPlay, IconPlayerStop } from './Icons';
import { botEngine } from '../core/botEngine';

const BotControlPanel: React.FC = () => {
  const {
    autonomousBotActive,
    autonomousBotStatus,
    setAutonomousBotActive,
  } = useAppStore();

  const handleToggleBot = () => {
    if (autonomousBotActive) {
      botEngine.stop();
      setAutonomousBotActive(false);
    } else {
      botEngine.start();
      setAutonomousBotActive(true);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-2 border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">Autonomous Gemini Bot Control</h2>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${autonomousBotActive ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>
            {autonomousBotActive ? 'Active' : 'Inactive'}
          </span>
          <button onClick={handleToggleBot} className={`btn ${autonomousBotActive ? 'btn-danger' : 'btn-success'} flex items-center`}>
            {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
            {autonomousBotActive ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Bot Status & Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status: <span className="font-semibold">{autonomousBotStatus}</span></p>
      </div>
    </div>
  );
};

export default BotControlPanel;