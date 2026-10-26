import { Router } from 'express';
import { z } from 'zod';

import { authRateLimit } from '../middleware/auth-rate-limit.js';
import { lookupUniversityStudent, StudentLookupError } from '../utils/estudiantes.js';

const router = Router();

const dniSchema = z.string().regex(/^\d{8}$/);

function validateDni(request, response, next) {
  const parsedDni = dniSchema.safeParse(request.params.dni);
  if (!parsedDni.success) {
    response.status(400).json({ error: 'El DNI debe contener exactamente 8 dígitos.' });
    return;
  }
  next();
}

router.get('/consultar/:dni', validateDni, authRateLimit('student-lookup'), async (request, response, next) => {
  const dni = dniSchema.parse(request.params.dni);
  try {
    response.json(await lookupUniversityStudent(dni));
  } catch (error) {
    if (error instanceof StudentLookupError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
