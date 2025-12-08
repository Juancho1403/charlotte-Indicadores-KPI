
/**
 * Ejemplo de función de utilidad.
 * Formatea una fecha a un string legible.
 * @param {Date} date 
 * @returns {string}
 */
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(date);
};
