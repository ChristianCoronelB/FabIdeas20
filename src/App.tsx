/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  MapPin, 
  Users, 
  QrCode, 
  User, 
  LogOut, 
  ChevronRight, 
  Clock, 
  Trophy, 
  FileText, 
  LayoutDashboard, 
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import { Scanner } from '@yudiel/react-qr-scanner';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserData {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  institution?: string;
  points?: number;
}

interface Activity {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  room_id: number;
  room_name: string;
  speaker_id: number;
  speaker_name: string;
  theme: string;
  description: string;
  status: 'pending' | 'in_progress' | 'finished';
}

interface Room {
  id: number;
  name: string;
  capacity: number;
  latitude: number;
  longitude: number;
  qr_code: string;
}

interface Speaker {
  id: number;
  name: string;
  bio: string;
  topic: string;
  social_links?: string;
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-700',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  };
  return (
    <button 
      className={cn('px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2', variants[variant], className)} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-medium text-gray-700 ml-1">{label}</label>}
    <input 
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-gray-50/50" 
      {...props} 
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'login' | 'register' | 'agenda' | 'map' | 'scanner' | 'profile' | 'admin'>('login');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setView(parsedUser.role === 'admin' ? 'admin' : 'agenda');
      }
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [actRes, roomRes] = await Promise.all([
        fetch('/api/activities'),
        fetch('/api/rooms')
      ]);
      setActivities(await actRes.json());
      setRooms(await roomRes.json());
    } catch (e) {
      console.error("Error fetching data", e);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.token) {
        setToken(result.token);
        setUser(result.user);
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        setView(result.user.role === 'admin' ? 'admin' : 'agenda');
      } else {
        setMessage({ text: result.error, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: "Error de conexión", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setView('login');
  };

  const registerAttendance = async (activityId: number) => {
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activity_id: activityId })
      });
      const result = await res.json();
      if (result.success) {
        setMessage({ text: `¡Asistencia registrada! +${result.points_earned} puntos`, type: 'success' });
        fetchData(); 
      } else {
        setMessage({ text: result.error, type: 'error' });
      }
    } catch (e) {
      setMessage({ text: "Error al registrar asistencia", type: 'error' });
    }
  };

  // --- Views ---

  const LoginView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-200 mb-6">
            <Calendar className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fábrica de Ideas</h1>
          <p className="text-gray-500">Gestión Inteligente de Eventos</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <Input label="Correo Electrónico" name="email" type="email" placeholder="admin@fabrica.com" required />
            <Input label="Contraseña" name="password" type="password" placeholder="admin123" required />
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setView('register')} className="text-indigo-600 font-medium hover:underline">
              ¿No tienes cuenta? Regístrate
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );

  const AgendaView = () => (
    <div className="pb-24 pt-6 px-4 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agenda</h2>
          <p className="text-sm text-gray-500">Explora las actividades de hoy</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-600">
            <Filter size={20} />
          </button>
          <button className="p-2 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-600">
            <Search size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <motion.div key={activity.id} layout>
            <Card className="p-4 hover:border-indigo-200 transition-colors cursor-pointer group">
              <div className="flex gap-4">
                <div className="flex flex-col items-center justify-center min-w-[60px] py-2 bg-indigo-50 rounded-xl text-indigo-700">
                  <span className="text-xs font-bold uppercase">{activity.start_time}</span>
                  <div className="h-px w-4 bg-indigo-200 my-1" />
                  <Clock size={14} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {activity.theme}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                      activity.status === 'in_progress' ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {activity.status === 'in_progress' ? "En curso" : "Próxima"}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{activity.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      <span>{activity.speaker_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      <span>{activity.room_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <ChevronRight className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No hay actividades programadas aún.
          </div>
        )}
      </div>
    </div>
  );

  const ScannerView = () => {
    const [scanned, setScanned] = useState(false);

    const handleScan = (result: any) => {
      if (result && !scanned) {
        setScanned(true);
        // For demo, register attendance to the first activity
        if (activities.length > 0) {
          registerAttendance(activities[0].id);
          setTimeout(() => setView('agenda'), 2000);
        }
      }
    };

    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="p-6 flex items-center justify-between text-white">
          <h2 className="text-xl font-bold">Escanear QR</h2>
          <button onClick={() => setView('agenda')} className="p-2 rounded-full bg-white/10">
            <LogOut size={20} />
          </button>
        </div>
        <div className="flex-1 relative flex items-center justify-center">
          <div className="w-72 h-72 border-2 border-indigo-500 rounded-3xl overflow-hidden relative">
            <Scanner onScan={handleScan} />
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none" />
            <motion.div 
              animate={{ y: [0, 280, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]"
            />
          </div>
        </div>
      </div>
    );
  };

  const ProfileView = () => {
    const [attendance, setAttendance] = useState<any[]>([]);

    useEffect(() => {
      const fetchAttendance = async () => {
        const res = await fetch('/api/user/attendance', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAttendance(await res.json());
      };
      fetchAttendance();
    }, []);

    const generateCertificate = () => {
      const doc = new jsPDF();
      doc.setFontSize(30);
      doc.text("Certificado de Participación", 20, 40);
      doc.setFontSize(16);
      doc.text(`Otorgado a: ${user?.name}`, 20, 60);
      doc.text(`Evento: Fábrica de Ideas 2026`, 20, 75);
      doc.text(`Actividades asistidas: ${attendance.length}`, 20, 90);
      doc.save("certificado.pdf");
    };

    return (
      <div className="pb-24 pt-6 px-4 space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
            <User size={48} className="text-indigo-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 bg-indigo-600 text-white border-none">
            <Trophy className="mb-2 opacity-80" size={24} />
            <div className="text-2xl font-bold">{user?.points || 0}</div>
            <div className="text-xs opacity-80 uppercase tracking-wider font-bold">Puntos</div>
          </Card>
          <Card className="p-4 bg-emerald-600 text-white border-none">
            <CheckCircle2 className="mb-2 opacity-80" size={24} />
            <div className="text-2xl font-bold">{attendance.length}</div>
            <div className="text-xs opacity-80 uppercase tracking-wider font-bold">Asistencias</div>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Historial</h3>
          <div className="space-y-3">
            {attendance.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                <div>
                  <div className="font-bold text-sm text-gray-900">{item.activity_name}</div>
                  <div className="text-xs text-gray-500">{item.room_name}</div>
                </div>
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={generateCertificate} className="w-full" variant="outline">
          Descargar Certificado (PDF)
        </Button>

        <Button onClick={handleLogout} className="w-full" variant="ghost">
          Cerrar Sesión
        </Button>
      </div>
    );
  };

  const AdminView = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
      const fetchStats = async () => {
        const res = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setStats(await res.json());
      };
      fetchStats();
    }, []);

    return (
      <div className="pb-24 pt-6 px-4 space-y-8">
        <h2 className="text-2xl font-bold text-gray-900">Panel Admin</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <Users className="text-indigo-600 mb-2" size={20} />
            <div className="text-2xl font-bold text-gray-900">{stats?.totalUsers?.count || 0}</div>
            <div className="text-xs text-gray-500 uppercase font-bold">Usuarios</div>
          </Card>
          <Card className="p-4">
            <CheckCircle2 className="text-emerald-600 mb-2" size={20} />
            <div className="text-2xl font-bold text-gray-900">{stats?.totalAttendance?.count || 0}</div>
            <div className="text-xs text-gray-500 uppercase font-bold">Asistencias</div>
          </Card>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Actividades Populares</h3>
          {stats?.popularActivities?.map((act: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
              <span className="text-sm font-medium">{act.name}</span>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                {act.count} asistentes
              </span>
            </div>
          ))}
        </div>
        <Button onClick={handleLogout} className="w-full" variant="ghost">Cerrar Sesión</Button>
      </div>
    );
  };

  const MapView = () => (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-white border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Mapa del Evento</h2>
      </div>
      <div className="flex-1 bg-gray-100 relative">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 italic">
          Mapa Interactivo (Leaflet)
        </div>
        {rooms.map((room, idx) => (
          <div 
            key={room.id}
            className="absolute p-2 bg-white rounded-xl shadow-lg border border-indigo-100"
            style={{ top: `${30 + idx * 15}%`, left: `${20 + idx * 20}%` }}
          >
            <div className="text-xs font-bold">{room.name}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // --- Render ---

  if (!token && view !== 'register') return <LoginView />;
  if (view === 'register') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center">Crear Cuenta</h1>
        <Card className="p-8">
          <form className="space-y-4">
            <Input label="Nombre Completo" placeholder="Juan Pérez" required />
            <Input label="Correo Electrónico" type="email" placeholder="juan@ejemplo.com" required />
            <Input label="Contraseña" type="password" placeholder="••••••••" required />
            <Button type="button" onClick={() => setView('login')} className="w-full h-12">Registrarse</Button>
          </form>
          <button onClick={() => setView('login')} className="w-full mt-4 text-sm text-gray-500">
            Volver al login
          </button>
        </Card>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 max-w-md mx-auto relative shadow-2xl">
      {view !== 'scanner' && view !== 'map' && (
        <header className="px-6 pt-8 pb-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Calendar size={20} />
            </div>
            <h1 className="font-bold text-lg">Fábrica de Ideas</h1>
          </div>
          <button onClick={() => setView('profile')} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="text-gray-400" />
          </button>
        </header>
      )}

      <main className="min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {view === 'agenda' && <AgendaView />}
            {view === 'map' && <MapView />}
            {view === 'scanner' && <ScannerView />}
            {view === 'profile' && <ProfileView />}
            {view === 'admin' && <AdminView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'scanner' && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between z-30">
          <NavButton active={view === 'agenda'} icon={<Calendar size={22} />} label="Agenda" onClick={() => setView('agenda')} />
          <NavButton active={view === 'map'} icon={<MapPin size={22} />} label="Mapa" onClick={() => setView('map')} />
          <div className="relative -top-8">
            <button onClick={() => setView('scanner')} className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-white">
              <QrCode size={28} />
            </button>
          </div>
          <NavButton active={view === 'profile'} icon={<Trophy size={22} />} label="Premios" onClick={() => setView('profile')} />
          <NavButton active={view === 'admin'} icon={<LayoutDashboard size={22} />} label="Admin" onClick={() => setView('admin')} />
        </nav>
      )}

      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[320px] z-50">
            <div className={cn("p-4 rounded-2xl shadow-2xl flex items-center gap-3 border", message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800")}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-medium flex-1">{message.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NavButton = ({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className={cn("flex flex-col items-center gap-1", active ? "text-indigo-600" : "text-gray-400")}>
    {icon}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);
