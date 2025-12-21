import React from 'react';
import { useAppStore } from '../store/appStore';
import { personas } from '../config/personas';
import { DVACH_DOMAINS, SUPPORTED_GEMINI_TEXT_MODELS } from '../config/constants';
import { generateUserAgent } from '../core/utils/userAgentGenerator';

const Settings: React.FC = () => {
  const { settings, updateSettings } = useAppStore();

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>

      {/* Persona and Bot Mode Settings */}
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Bot Configuration</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="persona" className="block text-sm font-medium">Persona Preset:</label>
            <select
              id="persona"
              value={settings.persona}
              onChange={e => updateSettings({ persona: e.target.value })}
              className="input-field mt-1 w-full"
            >
              {personas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="botMode" className="block text-sm font-medium">Bot Operation Mode:</label>
            <select
              id="botMode"
              value={settings.botOperationMode}
              onChange={e => updateSettings({ botOperationMode: e.target.value as 'observer' | 'protagonist' })}
              className="input-field mt-1 w-full"
            >
              <option value="observer">Contextual Observer</option>
              <option value="protagonist">Protagonist</option>
            </select>
          </div>
        </div>
      </details>

      {/* Dvach Settings */}
      <details className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Dvach Connection</summary>
        <div className="mt-3 space-y-3">
            <div><label htmlFor="settingsBoard" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Board (Manual Ops):</label><input id="settingsBoard" type="text" value={settings.board} onChange={e=>updateSettings({board:e.target.value})} className="input-field mt-1"/></div>
            <div><label htmlFor="settingsThreadId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Thread ID (Manual Ops):</label><input id="settingsThreadId" type="text" value={settings.threadId} onChange={e=>updateSettings({threadId:e.target.value})} className="input-field mt-1"/></div>
            <div>
              <label htmlFor="settingsDomainUsageMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dvach Base Domain:</label>
              <select id="settingsDomainUsageMode" value={settings.dvachDomainUsageMode} onChange={e => updateSettings({ dvachDomainUsageMode: e.target.value as 'predefined' | 'custom' })} className="input-field mt-1">
                <option value="predefined">Use Predefined Domain</option>
                <option value="custom">Use Custom Domain</option>
              </select>
            </div>
            {settings.dvachDomainUsageMode === 'predefined' && (
              <div>
                <label htmlFor="settingsDvachBaseDomainIndex" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Predefined Domain:</label>
                <select id="settingsDvachBaseDomainIndex" value={settings.dvachBaseDomainIndex} onChange={e => updateSettings({ dvachBaseDomainIndex: parseInt(e.target.value) })} className="input-field mt-1">
                  {DVACH_DOMAINS.map((domain, index) => (
                    <option key={index} value={index}>{domain}</option>
                  ))}
                </select>
              </div>
            )}
            {settings.dvachDomainUsageMode === 'custom' && (
              <div>
                <label htmlFor="settingsCustomDvachDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom Dvach Domain URL:</label>
                <input id="settingsCustomDvachDomain" type="url" placeholder="e.g., https://2ch.life" value={settings.customDvachDomain} onChange={e => updateSettings({ customDvachDomain: e.target.value })} className="input-field mt-1" />
              </div>
            )}
            <div><label htmlFor="settingsPasscode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchased Passcode:</label><input id="settingsPasscode" type="password" value={settings.purchasedPasscode} onChange={e=>updateSettings({purchasedPasscode:e.target.value})} autoComplete="new-password" placeholder="Your Dvach Passcode" className="input-field mt-1"/></div>
            <div><label htmlFor="settingsUserAgent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Agent:</label><input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e=>updateSettings({userAgent:e.target.value})} className="input-field mt-1"/><button onClick={()=>updateSettings({userAgent:generateUserAgent()})} className="btn-secondary text-xs mt-1">Generate New</button></div>
        </div>
      </details>

      {/* Gemini Settings */}
      <details className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Gemini API & Model</summary>
        <div className="mt-3 space-y-3">
        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gemini API Key Source:</label><select aria-label="Gemini API Key Source" value={settings.geminiApiKeySource} onChange={e=>updateSettings({geminiApiKeySource:e.target.value as 'env'|'user'})} className="input-field mt-1"><option value="env">Environment Variable</option><option value="user">Manual Input</option></select>{settings.geminiApiKeySource==='user'&&(<input aria-label="User Gemini API Key" type="password" placeholder="Gemini API Key" value={settings.userGeminiApiKey} onChange={e=>updateSettings({userGeminiApiKey:e.target.value})} autoComplete="new-password" className="input-field mt-1"/>)}</div>
            <div>
              <label htmlFor="settingsGeminiModel" className="block text-sm font-medium">Text Model:</label>
              <select
                id="settingsGeminiModel"
                value={settings.geminiTextModel}
                onChange={e => updateSettings({geminiTextModel: e.target.value})}
                className="input-field mt-1 w-full"
              >
                {SUPPORTED_GEMINI_TEXT_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
        </div>
      </details>

    </div>
  );
};

export default Settings;