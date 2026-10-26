export type UserRole = 'supervisor' | 'practicante';

export interface Perfil {
  id: number;
  auth_user_id: string;
  codigo_6: string;
  rol: UserRole;
  nombre: string;
  apellido: string;
  curso_carrera: string;
  institucion: string;
  created_at: string;
  avatar_url: string | null;
}

export type User = Perfil;

export interface Asistencia {
  id: number;
  practicante_id: number;
  supervisor_id: number;
  qr_token: string;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  sincronizado: boolean;
}

export interface Vinculacion {
  id: number;
  supervisor_id: number;
  practicante_id: number;
  estado: 'pendiente' | 'activo';
  metodo: 'id' | 'qr';
  created_at: string;
}
