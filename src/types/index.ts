export type UserRole = 'supervisor' | 'alumno';

export interface Perfil {
  id: number;
  auth_user_id: string;
  dni: string;
  rol: UserRole;
  nombre: string;
  apellido: string;
  facultad: string;
  carrera: string;
  ciclo: string;
  created_at: string;
  avatar_url: string | null;
}

export type User = Perfil;

export interface Asistencia {
  id: number;
  alumno_id: number;
  supervisor_id: number;
  qr_token: string;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  sincronizado: boolean;
}

export interface Vinculacion {
  id: number;
  supervisor_id: number;
  alumno_id: number;
  estado: 'pendiente' | 'activo';
  metodo: 'id' | 'qr';
  created_at: string;
}
