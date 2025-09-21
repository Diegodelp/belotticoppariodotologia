import { useState, useEffect } from 'react';
import { PatientService } from '@/services/patient.service';

export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PatientService.getAll().then(data => {
      setPatients(data);
      setLoading(false);
    });
  }, []);

  return { patients, loading };
}
