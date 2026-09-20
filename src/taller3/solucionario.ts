/**
 * La clave de corrección del Taller 3.
 *
 * Vive aquí, en el servicio, y no en la aplicación de conducción: el navegador
 * del tutor recibe los puntos ya calculados y nunca ve qué fragmentos estaban
 * mal antes de que el aula los discuta. Es la misma regla del Taller 1.
 *
 * Fuente: `materiales/taller3/solucionario.md` del repositorio de talleres.
 * Ocho defectuosas y doce correctas.
 */

export const FRAGMENTOS = 20

export const DEFECTUOSOS: readonly number[] = [2, 7, 10, 11, 15, 17, 19, 20]

export function esDefectuoso(numero: number): boolean {
  return DEFECTUOSOS.includes(numero)
}

export type Letra = 'a' | 'b' | 'c' | 'd'

/**
 * Puntos de cada veredicto, en el orden [si el fragmento está mal, si es
 * correcto]. Acusar en falso cuesta lo mismo que descubrir una falsedad gana, y
 * avalar una mentira cuesta otro tanto. «No verificado» no resta: es la salida
 * honesta, y sin ella quien no llega a todo se siente obligado a inventar.
 */
const PUNTOS: Record<Letra, [number, number]> = {
  a: [3, -3],
  b: [1, -1],
  c: [-3, 1],
  d: [0, 0],
}

export function puntosDe(letra: Letra, defectuoso: boolean): number {
  return PUNTOS[letra][defectuoso ? 0 : 1]
}
