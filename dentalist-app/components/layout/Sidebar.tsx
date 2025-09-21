'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  
  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/patients', label: 'Pacientes', icon: '👥' },
    { href: '/calendar', label: 'Calendario', icon: '📅' },
    { href: '/treatments', label: 'Tratamientos', icon: '🦷' },
    { href: '/payments', label: 'Pagos', icon: '💳' },
    { href: '/settings', label: 'Configuración', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white">
      <div className="p-4">
        <h2 className="text-2xl font-bold">Dentalist</h2>
      </div>
      <nav className="mt-8">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-4 py-3 hover:bg-gray-800 ${
              pathname === item.href ? 'bg-gray-800' : ''
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}