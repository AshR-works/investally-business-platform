/** Ports techniques transverses, implémentés par l'Infrastructure. */
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Exécute le travail dans une transaction unique (agrégat + audit atomiques). */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const CLOCK = Symbol('Clock');
export const ID_GENERATOR = Symbol('IdGenerator');
export const UNIT_OF_WORK = Symbol('UnitOfWork');
