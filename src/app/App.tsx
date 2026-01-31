import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { botEngine } from '../core/botEngine';
import BotControlPanel from '../components/BotControlPanel';
import LogViewer from '../components/LogViewer';
import Settings from '../components/Settings';
import ManualOpsPanel from '../components/ManualOpsPanel';
import { IconCpu, IconMessageChat, IconSettings, IconTerminal } from '../components/Icons';

const App: React.FC = () => {
  const { initializeAi } = useAppStore();
  const [activeTab, setActiveTab] = useState<'bot_control' | 'settings' | 'logs' | 'manual_ops'>('bot_control');

  useEffect(() => {
    initializeAi();
  }, [initializeAi]);

  useEffect(() => {
    // Start/stop bot engine based on global state
    const unsubscribe = useAppStore.subscribe(
      (state) => {
        if (state.autonomousBotActive) {
          botEngine.start();
        } else {
          botEngine.stop();
        }
      }
    );
    return unsubscribe;
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'bot_control':
        return <BotControlPanel />;
      case 'settings':
        return <Settings />;
      case 'logs':
        return <LogViewer />;
      case 'manual_ops':
        return <ManualOpsPanel />;
      default:
        return <BotControlPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Dvach Gemini Bot v2.0</h1>
      </header>
      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40">
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'bot_control', label: 'Bot Control', icon: IconMessageChat },
            { id: 'manual_ops', label: 'Manual Ops', icon: IconCpu },
            { id: 'settings', label: 'Settings', icon: IconSettings },
            { id: 'logs', label: 'Logs', icon: IconTerminal },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`nav-tab-button ${activeTab === tab.id ? 'nav-tab-active' : 'nav-tab-inactive'}`}
            >
              <tab.icon className="h-5 w-5 mr-1.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="container mx-auto p-4 md:p-6">
        {renderActiveTab()}
      </main>
    </div>
  );
};

export default App;