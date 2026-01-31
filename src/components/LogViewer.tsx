import React from 'react';
import { useAppStore } from '../store/appStore';
import { IconTrash } from './Icons';

// Helper function for formatting log data
const formatLogDataForDisplay = (data: unknown): string | null => {
  if (data === undefined || data === null) {
    return null;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Error) {
    return `Error: ${data.message}\nStack: ${data.stack}`;
  }
  if (typeof data === 'object' || Array.isArray(data)) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return `[Unserializable Object: ${(e as Error).message || 'Serialization Error'}]`;
    }
  }
  return String(data);
};


const LogViewer: React.FC = () => {
  const { logs, clearLogs } = useAppStore();

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Event Logs</h2>
        <button onClick={clearLogs} className="btn-danger text-xs flex items-center" title="Clear Logs" disabled={logs.length===0}>
          <IconTrash className="mr-1 h-4 w-4"/>Clear Logs
        </button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log => {
          const dataDisplay: string | null = (log.data !== undefined && log.data !== null) ? formatLogDataForDisplay(log.data) : null;
          return (
            <div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${log.type==='error'||log.type==='bot_error'?'log-error':log.type==='success'?'log-success':log.type==='warning'||log.type==='bot_warning'?'log-warning':log.type==='gemini'?'log-gemini':log.type==='dvach'?'log-dvach':log.type==='auth'?'log-auth':log.type==='bot_activity'||log.type==='bot_setup'?'log-bot': 'log-info'}`}>
              <span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}
              {dataDisplay && (<pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-200 dark:bg-gray-600 p-1 rounded overflow-x-auto">{dataDisplay}</pre>)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogViewer;