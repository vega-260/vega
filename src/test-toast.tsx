import React, { useEffect } from 'react';
import { toast } from 'react-hot-toast';

export function TestToast() {
  useEffect(() => {
    toast.success('Test Toast from component', { duration: 3000 });
  }, []);
  return null;
}
