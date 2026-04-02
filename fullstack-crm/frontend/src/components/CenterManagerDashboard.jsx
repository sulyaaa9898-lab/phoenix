import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ManagerWorkspace } from './ManagerWorkspace';
import { setApiContext } from '../lib/api';

export function CenterManagerDashboard() {
  const { centerId } = useParams();

  useEffect(() => {
    if (!centerId) {
      return;
    }

    setApiContext({
      role: 'manager',
      centerId,
      userId: '00000000-0000-0000-0000-000000000003',
    });
  }, [centerId]);

  return <ManagerWorkspace />;
}
