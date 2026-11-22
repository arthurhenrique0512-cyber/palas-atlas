export type FirestoreTimestamp =
  | string
  | number
  | { seconds: number; nanoseconds?: number }
  | null;

export interface SummaryPoint {
  label: string;
  text: string;
}

export interface ModuloData {
  id: string;
  title: string;
  category: string;
  summaryPoints: SummaryPoint[];
  bibliographicReference: string;
  associatedSlides: string[];
  updatedAt?: FirestoreTimestamp;
}

export interface SlideCardData {
  id: string;
  nome: string;
  coloracao?: string;
  thumbnailUrl?: string;
  topico?: string;
  disciplina?: string;
  maxMagnification?: string | number;
  dziUrl?: string;
  imagemUrl?: string;
}

export interface SlideItem {
  id: string;
  title: string;
  category: string;
  stain?: string;
  thumbnailUrl: string;
  link: string;
  disciplina: string;
  tags?: string[];
}

export interface DisciplinaItem {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  icone: string;
  totalLaminas: number;
}

export interface FirestoreDocSnapshot<T> {
  id: string;
  exists: boolean;
  data(): T | undefined;
}

export interface FirestoreQueryDocSnapshot<T> {
  id: string;
  data(): T;
}

export interface FirestoreQuerySnapshot<T> {
  forEach(callback: (doc: FirestoreQueryDocSnapshot<T>) => void): void;
}

export type FirestoreUnsubscribe = () => void;

export interface FirestoreDocRef<T> {
  onSnapshot(
    onNext: (snapshot: FirestoreDocSnapshot<T>) => void,
    onError?: (error: unknown) => void
  ): FirestoreUnsubscribe;
}

export interface FirestoreQueryRef<T> {
  onSnapshot(
    onNext: (snapshot: FirestoreQuerySnapshot<T>) => void,
    onError?: (error: unknown) => void
  ): FirestoreUnsubscribe;
}

export interface FirestoreCollectionRef {
  doc<T = Record<string, unknown>>(id: string): FirestoreDocRef<T>;
  where<T = Record<string, unknown>>(
    fieldPath: string,
    opStr: string,
    value: unknown
  ): FirestoreQueryRef<T>;
}

export interface FirestoreCompatInstance {
  collection(path: string): FirestoreCollectionRef;
}

export interface FirebaseCompatNamespace {
  firestore?: () => FirestoreCompatInstance;
}

export type WindowWithFirebase = Window & {
  firebase?: FirebaseCompatNamespace;
};
