export class PatientService {
  static async getAll() {
    const response = await fetch('/api/patients', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  }

  static async getById(id: string) {
    const response = await fetch(`/api/patients/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  }

  static async create(data: any) {
    const response = await fetch('/api/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
}
