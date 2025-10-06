import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

export default function RouteError() {
  const error = useRouteError();
  let title = 'Unexpected Application Error';
  let message = '';

  try {
    if (typeof isRouteErrorResponse === 'function' && isRouteErrorResponse(error)) {
      title = `${error.status} ${error.statusText || ''}`.trim();
      const data = error?.data;
      if (typeof data === 'string') message = data;
      else if (data && typeof data === 'object') message = data.message || JSON.stringify(data);
      else message = error.statusText || '';
    } else if (error instanceof Error) {
      title = error.name || title;
      message = error.message || '';
    } else if (error && typeof error === 'object') {
      message = error.message || error.error || JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    }
  } catch {
    // fall through with default title/message
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h1>
      <div style={{ color: '#555', whiteSpace: 'pre-wrap' }}>{String(message || 'An unknown error occurred.')}</div>
      <div style={{ marginTop: 12 }}>
        <a href="/" style={{ color: '#2563eb' }}>Go Home</a>
      </div>
    </div>
  );
}

