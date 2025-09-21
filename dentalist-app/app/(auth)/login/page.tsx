'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ dni: '', password: '', type: 'profesional' });
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar login
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Iniciar Sesión
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border"
                placeholder="DNI"
                value={credentials.dni}
                onChange={(e) => setCredentials({...credentials, dni: e.target.value})}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border"
                placeholder="Contraseña"
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
}