'use client';

import { useDashboardAlerts } from '../hooks/useDashboardAlerts';

export default function DashboardAlerts() {
  useDashboardAlerts();
  return null; // This component just runs the hook
}