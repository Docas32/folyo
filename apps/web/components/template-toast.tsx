'use client';
import { useEffect, useState } from 'react';
export function TemplateToast() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const toast = sessionStorage.getItem('folyo-template-toast');
    if (toast) {
      setMessage(toast);
      sessionStorage.removeItem('folyo-template-toast');
    }
  }, []);
  return message ? (
    <p role="status" className="template-toast">
      {message}
    </p>
  ) : null;
}
