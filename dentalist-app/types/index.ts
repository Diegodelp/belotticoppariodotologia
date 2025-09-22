export interface User {
  id: string;
  dni: string;
  name: string;
  email: string;
  type: 'profesional' | 'paciente';
}

export interface Patient {
  id: string;
  dni: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  healthInsurance: string;
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  type: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface Treatment {
  id: string;
  patientId: string;
  type: string;
  description: string;
  cost: number;
  date: string;
}

export interface Payment {
  id: string;
  patientId: string;
  amount: number;
  method: 'cash' | 'card' | 'transfer' | 'other';
  status: 'pending' | 'completed';
  date: string;
  notes?: string;
}
