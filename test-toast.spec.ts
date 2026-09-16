import { test, expect } from '@playwright/test';
test('toast disappears', async ({ page }) => {
  await page.goto('http://localhost:3000/resume-analysis');
  // wait for react to mount
  await page.waitForTimeout(2000);
  
  // mock user? Or just inject a toast
  await page.evaluate(() => {
    window.__triggerToast = () => {
      const { toast } = require('react-hot-toast');
      toast.success('Test Toast', { duration: 1000 });
    }
  });
});
